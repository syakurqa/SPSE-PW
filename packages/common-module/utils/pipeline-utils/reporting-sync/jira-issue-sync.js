/* eslint-disable no-console */
/**
 * Jira Issue Sync Script
 *
 * Fetches issues from Jira Cloud API for each squad's project (from zephyr-config),
 * upserts into the local jira_issues table for dashboard consumption.
 *
 * The jira_issues table is the local replica that powers the Jira data tables
 * in the monitoring dashboard — same schema used by the backend DataTable API.
 *
 * Usage: npm run reporting:jira:sync --workspace=packages/common-module [-- --full]
 *   --full  Force full sync (no cutoff), also prunes deleted issues
 */

import args from 'args';
import { getConnection, destroyConnection } from '../lib/database.js';
import { env } from '../../../config/index.js';
import { zephyrConfig } from '../../../config/zephyr-config.js';

args.option('full', 'Force full sync (ignore cutoff, prune deleted)');
args.option('since', 'Start date for incremental sync (ISO format, e.g. 2026-01-01) — filters by created >= date OR updated >= date');
args.option('squad', 'Sync only this squad project key (e.g. B2B, CRW) — skips all others');

const JIRA_BASE_URL = env.JIRA.BASE_URL;
const JIRA_EMAIL = env.JIRA.EMAIL;
const JIRA_API_TOKEN = env.JIRA.API_TOKEN;

function authHeader() {
  const encoded = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return `Basic ${encoded}`;
}

// Squads whose Zephyr project key also identifies their Jira project.
const JIRA_SQUAD_KEYS = zephyrConfig.map(s => s.key);

async function jiraPostJql(jql, pageToken = null) {
  const { default: axios } = await import('axios');
  const sprintField = env.JIRA.SPRINT_FIELD || 'customfield_10020';
  const spField = env.JIRA.STORY_POINTS_FIELD || 'customfield_10016';
  const severityField = env.JIRA.SEVERITY_PROD_FIELD || null;
  const rootCauseField = env.JIRA.ROOT_CAUSE_FIELD || null;
  const body = {
    jql,
    maxResults: 100,
    fields: [
      'id', 'key',
      'project', 'summary', 'issuetype', 'status', 'priority',
      'assignee', 'reporter',
      'labels',
      'created', 'resolutiondate', 'duedate', 'statuscategorychangedate',
      spField, sprintField, severityField, rootCauseField,
    ].filter(Boolean),
  };
  if (pageToken) body.nextPageToken = pageToken;
  const response = await axios.post(
    `${JIRA_BASE_URL}/rest/api/3/search/jql`,
    body,
    {
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

async function fetchAllIssues(jql) {
  const issues = [];
  let pageToken = null;
  do {
    const data = await jiraPostJql(jql, pageToken);
    issues.push(...(data.issues || []));
    pageToken = data.isLast ? null : data.nextPageToken;
  } while (pageToken);
  return issues;
}

/**
 * Fetch changelogs for issues that have left the To Do category.
 * The standalone /issue/{id}/changelog endpoint is the only way to get
 * per-transition timestamps — the search API doesn't inline changelogs.
 */
async function enrichIssuesWithChangelog(issues) {
  const { default: axios } = await import('axios');
  const todoStatuses = new Set(['To Do', 'Backlog', 'Open', 'Selected for Development']);
  const targets = issues.filter(i => {
    const status = i.fields?.status?.name;
    return status && !todoStatuses.has(status);
  });
  if (targets.length === 0) return;
  console.log(`   Fetching changelogs for ${targets.length} issues...`);

  for (let i = 0; i < targets.length; i += 10) {
    await Promise.all(targets.slice(i, i + 10).map(async (issue) => {
      try {
        const { data } = await axios.get(
          `${JIRA_BASE_URL}/rest/api/3/issue/${issue.id}?expand=changelog&fields=id,key`,
          { headers: { Authorization: authHeader() } }
        );
        if (data?.changelog?.histories) {
          issue.changelog = data.changelog;
        }
      } catch (_) { /* fallback to statuscategorychangedate */ }
    }));
  }
}

function latestSprint(sprints) {
  if (!Array.isArray(sprints) || sprints.length === 0) return null;
  // Active sprint first; else the most recently completed
  const active = sprints.find(s => s.state === 'active');
  if (active) return active;
  return sprints
    .filter(s => s.state === 'closed' && s.completeDate)
    .sort((a, b) => new Date(b.completeDate) - new Date(a.completeDate))[0] || null;
}

function mapIssue(issue, projectKey, label = null) {
  const fields = issue.fields || {};
  const changelog = issue.changelog || null;
  const spField = env.JIRA.STORY_POINTS_FIELD || 'customfield_10016';
  const sprintField = env.JIRA.SPRINT_FIELD || 'customfield_10020';
  const severityField = env.JIRA.SEVERITY_PROD_FIELD || null;
  const rootCauseField = env.JIRA.ROOT_CAUSE_FIELD || null;

  // Always use Jira's standard priority (Critical, High, Medium, Low)
  const priority = fields.priority?.name || null;

  // Extract Severity_Prod for PRD issues (e.g. "HIGH (P1)", "LOW (P3)")
  let severity = null;
  if (severityField && fields[severityField]) {
    severity = fields[severityField].value || fields[severityField];
  }

  // Extract Root Cause Category (e.g. "Infrastructure Issues")
  let rootCauseCategory = null;
  if (rootCauseField && fields[rootCauseField]) {
    rootCauseCategory = fields[rootCauseField].value || fields[rootCauseField];
  }

  const sprint = latestSprint(fields[sprintField]);

  // Changelog-derived timestamps and cycle time (df-los algorithm)
  // - in_progress_at: first todo→wip transition (broad wip set)
  // - first_done_at:  first entry to Done status
  // - cycle_minutes:  accumulated time in "In Progress" across all periods
  let inProgressFromChangelog = null;
  let firstDoneAt = null;
  let cycleMinutes = null;
  if (changelog?.histories) {
    const sorted = [...changelog.histories].sort((a, b) =>
      (a.created || '').localeCompare(b.created || '')
    );
    const todoRx = /^(TODO|To Do|Backlog|Open|Selected for Development)$/i;
    const wipRx = /^(In Progress|Doing|In Development|In Review|Code Review)$/i;
    let lastInProgressEntered = null;
    let accumulated = 0;
    for (const h of sorted) {
      for (const item of h.items || []) {
        if (item.field !== 'status') continue;
        // first todo→wip (existing)
        if (!inProgressFromChangelog && todoRx.test(item.fromString || '') && wipRx.test(item.toString || '')) {
          inProgressFromChangelog = h.created;
        }
        // leaving In Progress → accumulate period
        if (item.fromString === 'In Progress' && lastInProgressEntered) {
          accumulated += (new Date(h.created) - new Date(lastInProgressEntered)) / 60000;
          lastInProgressEntered = null;
        }
        // entering In Progress
        if (item.toString === 'In Progress') {
          lastInProgressEntered = h.created;
        }
        // first entry to Done
        if (!firstDoneAt && item.toString === 'Done') {
          firstDoneAt = h.created;
        }
      }
    }
    if (accumulated > 0) cycleMinutes = Math.round(accumulated * 100) / 100;
  }

  const labels = Array.isArray(fields.labels) ? fields.labels : null;

  return {
    id: String(issue.id),
    key: issue.key,
    project_key: fields.project?.key || projectKey,
    summary: fields.summary || '',
    issue_type: fields.issuetype?.name || null,
    status: fields.status?.name || null,
    priority,
    severity,
    root_cause_category: rootCauseCategory,
    assignee: fields.assignee?.displayName || null,
    reporter: fields.reporter?.displayName || null,
    created_at: fields.created || null,
    resolved_at: fields.resolutiondate || null,
    in_progress_at: inProgressFromChangelog || fields.statuscategorychangedate || null,
    first_done_at: firstDoneAt,
    cycle_minutes: cycleMinutes,
    story_points: fields[spField] ?? null,
    label,
    labels,
    due_date: fields.duedate || null,
    sprint_name: sprint?.name || null,
    sprint_start: sprint?.startDate || null,
    sprint_end: sprint?.endDate || null,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Sync a regular project.
 */
async function syncProject(db, projectKey, since = null, isFull = false) {
  let jql = `project = ${projectKey} ORDER BY updated DESC`;
  if (since) {
    jql = `project = ${projectKey} AND (created >= "${since}" OR updated >= "${since}") ORDER BY updated DESC`;
  }

  console.log(`   JQL: ${jql}`);
  const issues = await fetchAllIssues(jql);
  console.log(`   Fetched ${issues.length} issues`);
  await enrichIssuesWithChangelog(issues);

  const seenKeys = new Set();
  for (const issue of issues) {
    const row = mapIssue(issue, projectKey);
    seenKeys.add(row.key);

    await db('jira_issues')
      .insert(row)
      .onConflict('id')
      .merge();
  }

  if (isFull && seenKeys.size > 0) {
    const deleted = await db('jira_issues')
      .where({ project_key: projectKey })
      .whereNotIn('key', [...seenKeys])
      .del();
    if (deleted > 0) {
      console.log(`   Pruned ${deleted} deleted issues`);
    }
  }

  return issues.length;
}

/**
 * Sync PRD per-team label.
 */
async function syncPrdProject(db, label, since = null, isFull = false) {
  let jql = `project = PRD AND issuetype = Bug AND labels = "${label}" AND created >= "2026-01-01" ORDER BY updated DESC`;
  if (since) {
    jql = `project = PRD AND issuetype = Bug AND labels = "${label}" AND (created >= "${since}" OR updated >= "${since}") ORDER BY updated DESC`;
  }

  console.log(`   JQL: ${jql}`);
  const issues = await fetchAllIssues(jql);
  console.log(`   Fetched ${issues.length} issues for label "${label}"`);
  await enrichIssuesWithChangelog(issues);

  const seenKeys = new Set();
  for (const issue of issues) {
    const row = mapIssue(issue, 'PRD', label);
    seenKeys.add(row.key);

    await db('jira_issues')
      .insert(row)
      .onConflict('id')
      .merge();
  }

  if (isFull && seenKeys.size > 0) {
    const deleted = await db('jira_issues')
      .where({
        project_key: 'PRD',
        label
      })
      .whereNotIn('key', [...seenKeys])
      .del();
    if (deleted > 0) {
      console.log(`   Pruned ${deleted} deleted PRD issues for label "${label}"`);
    }
  }

  return issues.length;
}

async function syncJiraIssues() {
  const argv = process.argv.filter(a => a !== '--');
  const flags = args.parse(argv);
  const isFull = !!flags.full;
  const explicitSince = flags.since || null;
  const squadFilter = flags.squad || null;

  const db = getConnection();

  const [syncLogEntry] = await db('sync_log')
    .insert({
      sync_type: 'JIRA_ISSUE_SYNC',
      status: 'STARTED',
      started_at: new Date().toISOString(),
    })
    .returning('*');

  console.log(`\n===== Jira Issue Sync Started (full: ${isFull}) =====\n`);

  try {
    const regular = JIRA_SQUAD_KEYS;
    const prdRows = await db('prd_label_mapping').select('squad_key', 'prd_label');
    const prdLabelMap = Object.fromEntries(prdRows.map(r => [r.squad_key, r.prd_label]));
    console.log(`Squads: ${regular.length} | PRD labels: ${prdRows.length}`);

    let totalSynced = 0;
    let errors = 0;

    let globalSince = null;
    if (explicitSince) {
      globalSince = explicitSince;
      console.log(`   Using explicit since: ${globalSince}`);
    } else if (!isFull) {
      const lastSync = await db('sync_log')
        .where({
          sync_type: 'JIRA_ISSUE_SYNC',
          status: 'COMPLETED'
        })
        .orderBy('completed_at', 'desc')
        .first();
      if (lastSync) {
        globalSince = new Date(lastSync.completed_at).toISOString().split('.')[0];
      }
    }

    let filteredRegular = regular;
    let filteredPrdRows = prdRows;

    if (squadFilter) {
      const upperFilter = squadFilter.toUpperCase();
      filteredRegular = regular.filter(k => k === upperFilter);
      filteredPrdRows = prdRows.filter(r => r.squad_key === upperFilter);
      if (filteredRegular.length === 0 && filteredPrdRows.length === 0) {
        console.warn(`   ⚠ No project found for squad "${squadFilter}". Valid squads: ${regular.join(', ')}`);
      }
    }

    for (const projectKey of filteredRegular) {
      console.log(`\n--- ${projectKey} ---`);
      try {
        const count = await syncProject(
          db, projectKey,
          globalSince ? globalSince : null,
          isFull
        );
        totalSynced += count;
      } catch (err) {
        console.error(`   ❌ Error syncing ${projectKey}: ${err.message}`);
        errors++;
      }
    }

    // PRD per-label sync
    for (const [squadKey, label] of Object.entries(prdLabelMap).filter(
      ([sk]) => !squadFilter || sk === squadFilter.toUpperCase()
    )) {
      console.log(`\n--- PRD [${label}] (${squadKey}) ---`);
      try {
        const count = await syncPrdProject(
          db, label,
          globalSince ? globalSince : null,
          isFull
        );
        totalSynced += count;
      } catch (err) {
        console.error(`   ❌ Error syncing PRD label "${label}": ${err.message}`);
        errors++;
      }
    }

    await db('sync_log').where({ id: syncLogEntry.id }).update({
      status: 'COMPLETED',
      details: JSON.stringify({
        synced: totalSynced,
        errors
      }),
      completed_at: new Date().toISOString(),
    });

    console.log(`\n===== Jira Issue Sync Completed: ${totalSynced} issues, ${errors} errors =====\n`);
  } catch (err) {
    await db('sync_log').where({ id: syncLogEntry.id }).update({
      status: 'FAILED',
      details: JSON.stringify({ error: err.message }),
      completed_at: new Date().toISOString(),
    });
    throw err;
  } finally {
    destroyConnection();
  }
}

syncJiraIssues().catch(err => {
  console.error('Jira sync failed:', err);
  destroyConnection();
  process.exit(1);
});
