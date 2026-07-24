/* eslint-disable no-console */
/**
 * Member Contribution Sync Script
 *
 * Parses git log for spec/page file changes, maps authors to members via
 * git aliases, and writes daily contribution aggregates to PostgreSQL.
 * Also parses git diffs to track individual test case additions/modifications/deletions.
 *
 * Usage:
 *   npm run contribution:sync                    # Yesterday's contributions
 *   npm run contribution:sync -- --since=2025-01-01  # Backfill from date
 *   npm run contribution:sync -- --days=7            # Last 7 days
 */

import { execSync } from 'node:child_process';
import { getConnection, destroyConnection } from '../lib/database.js';
import { TC_ID_REGEX } from '../lib/repo-scanner.js';

// File patterns to track (relative to repo root)
const TRACKED_PATTERNS = [
  '*',
];

// Files that count as "spec files" for the spec_files_added/modified metrics
const SPEC_PATTERNS = [/.*/]; // [/\.spec\.(js|ts)$/];

function parseArgs() {
  const args = process.argv.slice(2);
  let since = null;
  let days = 1; // default: yesterday

  for (const arg of args) {
    if (arg.startsWith('--since=')) {
      since = arg.split('=')[1];
    } else if (arg.startsWith('--days=')) {
      days = parseInt(arg.split('=')[1], 10);
    }
  }

  if (!since) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    since = d.toISOString().split('T')[0];
  }

  return { since };
}

/**
 * Parse git log for tracked file changes.
 * Returns an array of commit objects with author, date, and file stats.
 */
function getGitCommits(since) {
  const pathFilters = TRACKED_PATTERNS.map(p => `"${p}"`).join(' ');
  const separator = '---COMMIT_SEP---';
  const format = `${separator}%n%H%n%an%n%ae%n%aI`;

  // Find the git repo root (npm workspace changes cwd to the package dir)
  const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

  let output;
  try {
    output = execSync(
      `git --no-pager log --format='${format}' --numstat --since="${since}" -- ${pathFilters}`,
      {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        cwd: repoRoot,
      }
    );
  } catch (err) {
    if (err.status === 128) {
      console.log('ℹ️  No git commits found in the given range.');
      return [];
    }
    throw err;
  }

  if (!output.trim()) return [];

  const commits = [];
  const blocks = output.split(separator).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 4) continue;

    const [hash, authorName, authorEmail, dateISO] = lines;
    const date = dateISO.split('T')[0];
    const fileLines = lines.slice(4).filter(l => l.trim());

    const files = [];
    for (const fileLine of fileLines) {
      const parts = fileLine.split('\t');
      if (parts.length < 3) continue;
      const [added, removed, filePath] = parts;
      files.push({
        added: added === '-' ? 0 : parseInt(added, 10),
        removed: removed === '-' ? 0 : parseInt(removed, 10),
        path: filePath,
        isSpec: SPEC_PATTERNS.some(p => p.test(filePath)),
      });
    }

    if (files.length > 0) {
      commits.push({
        hash,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        date,
        files,
      });
    }
  }

  return commits;
}

/**
 * Build a lookup from (authorName, authorEmail) → memberId using the
 * member_git_aliases table. Returns a Map<string, number>.
 */
async function buildAuthorMap(db) {
  const aliases = await db('member_git_aliases')
    .join('members', 'members.id', 'member_git_aliases.member_id')
    .where('members.is_active', true)
    .select(
      'member_git_aliases.git_author_name',
      'member_git_aliases.git_author_email',
      'member_git_aliases.member_id'
    );

  const map = new Map();
  for (const alias of aliases) {
    if (alias.git_author_name) {
      map.set(`name:${alias.git_author_name.toLowerCase()}`, alias.member_id);
    }
    if (alias.git_author_email) {
      map.set(`email:${alias.git_author_email.toLowerCase()}`, alias.member_id);
    }
  }
  return map;
}

/**
 * Auto-map unmapped git authors to members by matching:
 * 1. git author name == member.github_username (case-insensitive)
 * 2. noreply email pattern: {id}+{username}@users.noreply.github.com → github_username
 *
 * Inserts matched aliases permanently into member_git_aliases.
 */
async function autoMapAuthors(db, commits, authorMap) {
  const members = await db('members').where({ is_active: true }).select('id', 'github_username', 'email');
  const usernameLookup = new Map();
  const emailLookup = new Map();
  for (const m of members) {
    if (m.github_username) {
      usernameLookup.set(m.github_username.toLowerCase(), m.id);
    }
    if (m.email) {
      emailLookup.set(m.email.toLowerCase(), m.id);
    }
  }

  // Collect unique unmapped authors
  const unmappedSet = new Map();
  for (const commit of commits) {
    const memberId = resolveMember(authorMap, commit.authorName, commit.authorEmail);
    if (!memberId) {
      const key = `${commit.authorName}|||${commit.authorEmail}`;
      if (!unmappedSet.has(key)) {
        unmappedSet.set(key, {
          name: commit.authorName,
          email: commit.authorEmail
        });
      }
    }
  }

  let autoMapped = 0;
  for (const { name, email } of unmappedSet.values()) {
    let memberId = null;

    // Strategy 1: git author name matches github_username
    memberId = usernameLookup.get(name.toLowerCase()) || null;

    // Strategy 2: noreply email → extract username
    if (!memberId) {
      const match = email.match(/\d+\+(.+)@users\.noreply\.github\.com/i);
      if (match) {
        memberId = usernameLookup.get(match[1].toLowerCase()) || null;
      }
    }

    // Strategy 3: git email matches member.email (case-insensitive)
    if (!memberId) {
      memberId = emailLookup.get(email.toLowerCase()) || null;
    }

    if (memberId) {
      // Insert aliases permanently (both name and email)
      try {
        await db('member_git_aliases')
          .insert({
            member_id: memberId,
            git_author_name: name,
            git_author_email: email
          })
          .onConflict(['git_author_name', 'git_author_email'])
          .ignore();
      } catch { /* ignore duplicates */ }

      authorMap.set(`name:${name.toLowerCase()}`, memberId);
      authorMap.set(`email:${email.toLowerCase()}`, memberId);
      autoMapped++;
    }
  }

  return autoMapped;
}

/**
 * Resolve a commit author to a member ID using the alias map.
 */
function resolveMember(authorMap, authorName, authorEmail) {
  // Try email first (more unique)
  const byEmail = authorMap.get(`email:${authorEmail.toLowerCase()}`);
  if (byEmail) return byEmail;

  // Then try name
  const byName = authorMap.get(`name:${authorName.toLowerCase()}`);
  if (byName) return byName;

  return null;
}

/**
 * Aggregate commits into daily contribution records per member.
 */
function aggregateContributions(commits, authorMap) {
  // Map<"memberId:date", aggregated>
  const aggregated = new Map();
  const unmappedAuthors = new Set();

  for (const commit of commits) {
    const memberId = resolveMember(authorMap, commit.authorName, commit.authorEmail);

    if (!memberId) {
      unmappedAuthors.add(`${commit.authorName} <${commit.authorEmail}>`);
      continue;
    }

    const key = `${memberId}:${commit.date}`;
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        member_id: memberId,
        contribution_date: commit.date,
        commits_count: 0,
        lines_added: 0,
        lines_removed: 0,
        files_changed: 0,
        spec_files_added: 0,
        spec_files_modified: 0,
      });
    }

    const agg = aggregated.get(key);
    agg.commits_count += 1;

    const uniqueFiles = new Set();
    for (const file of commit.files) {
      agg.lines_added += file.added;
      agg.lines_removed += file.removed;
      uniqueFiles.add(file.path);

      if (file.isSpec) {
        // Heuristic: if lines_added > lines_removed and removed == 0 → new file
        if (file.removed === 0 && file.added > 0) {
          agg.spec_files_added += 1;
        } else {
          agg.spec_files_modified += 1;
        }
      }
    }
    agg.files_changed += uniqueFiles.size;
  }

  return {
    aggregated,
    unmappedAuthors
  };
}

/**
 * Fetch merged PR counts per member for a date range using `gh` CLI.
 */
async function getMergedPRCounts(db, since) {
  const members = await db('members').where({ is_active: true }).whereNotNull('github_username');
  const prCounts = new Map(); // "memberId:date" → count

  for (const member of members) {
    try {
      const output = execSync(
        `gh pr list --author="${member.github_username}" --state=merged --search="merged:>=${since}" --json mergedAt --limit 500`,
        {
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      const prs = JSON.parse(output || '[]');
      for (const pr of prs) {
        if (!pr.mergedAt) continue;
        const date = pr.mergedAt.split('T')[0];
        const key = `${member.id}:${date}`;
        prCounts.set(key, (prCounts.get(key) || 0) + 1);
      }
    } catch {
      // gh CLI not available or API error — skip silently
    }
  }

  return prCounts;
}

/**
 * Write aggregated contribution data to the database.
 */
async function writeContributions(db, aggregated, prCounts) {
  let written = 0;

  for (const [key, data] of aggregated) {
    const prCount = prCounts.get(key) || 0;

    await db('member_daily_contributions')
      .insert({
        ...data,
        pr_merged_count: prCount,
      })
      .onConflict(['member_id', 'contribution_date'])
      .merge({
        commits_count: data.commits_count,
        lines_added: data.lines_added,
        lines_removed: data.lines_removed,
        files_changed: data.files_changed,
        spec_files_added: data.spec_files_added,
        spec_files_modified: data.spec_files_modified,
        pr_merged_count: prCount,
        updated_at: db.fn.now(),
      });

    written++;
  }

  return written;
}

/**
 * Parse git diff for a commit to extract test case ID changes.
 * Returns arrays of added and deleted test case IDs per file.
 */
function getTestCaseChanges(commitHash, repoRoot) {
  let diffOutput;
  try {
    diffOutput = execSync(
      `git --no-pager diff-tree -p --diff-filter=ADMR ${commitHash} -- ${TRACKED_PATTERNS.map(p => `"${p}"`).join(' ')}`,
      {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        cwd: repoRoot
      }
    );
  } catch {
    return [];
  }

  if (!diffOutput.trim()) return [];

  const changes = [];
  let currentFile = null;

  for (const line of diffOutput.split('\n')) {
    // Detect file path from diff header
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      continue;
    }
    if (line.startsWith('--- a/')) continue;

    if (!currentFile) continue;

    // Only process added/removed lines (not context)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const matches = line.matchAll(TC_ID_REGEX);
      for (const match of matches) {
        changes.push({
          testCaseKey: match[1],
          zephyrProjectKey: match[1].replace(/-T\d+$/, ''),
          changeType: 'ADDED',
          filePath: currentFile,
        });
      }
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      const matches = line.matchAll(TC_ID_REGEX);
      for (const match of matches) {
        changes.push({
          testCaseKey: match[1],
          zephyrProjectKey: match[1].replace(/-T\d+$/, ''),
          changeType: 'DELETED',
          filePath: currentFile,
        });
      }
    }
  }

  // Deduplicate: if same test case appears in both added and deleted → MODIFIED
  const byKey = new Map();
  for (const change of changes) {
    const key = `${change.testCaseKey}:${change.filePath}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...change,
        types: new Set([change.changeType])
      });
    } else {
      byKey.get(key).types.add(change.changeType);
    }
  }

  const result = [];
  for (const [, entry] of byKey) {
    if (entry.types.has('ADDED') && entry.types.has('DELETED')) {
      result.push({
        ...entry,
        changeType: 'MODIFIED'
      });
    } else {
      result.push({
        ...entry,
        changeType: entry.types.values().next().value
      });
    }
  }

  return result;
}

/**
 * Write test case changes to the database.
 */
async function writeTestCaseChanges(db, commits, authorMap, repoRoot) {
  let written = 0;
  const processedCommits = new Set();

  for (const commit of commits) {
    const memberId = resolveMember(authorMap, commit.authorName, commit.authorEmail);
    if (!memberId) continue;
    if (processedCommits.has(commit.hash)) continue;
    processedCommits.add(commit.hash);

    const changes = getTestCaseChanges(commit.hash, repoRoot);
    for (const change of changes) {
      try {
        await db('member_test_case_changes')
          .insert({
            member_id: memberId,
            change_date: commit.date,
            test_case_key: change.testCaseKey,
            zephyr_project_key: change.zephyrProjectKey,
            change_type: change.changeType,
            file_path: change.filePath,
            commit_hash: commit.hash,
          })
          .onConflict(db.raw('(commit_hash, test_case_key, change_type)'))
          .ignore();
        written++;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
  }

  return written;
}

async function syncContributions() {
  const { since } = parseArgs();
  const db = getConnection();

  console.log(`\n===== Member Contribution Sync (since: ${since}) =====\n`);

  const [syncLogEntry] = await db('sync_log')
    .insert({
      sync_type: 'CONTRIBUTION_SYNC',
      status: 'STARTED',
      started_at: new Date().toISOString(),
    })
    .returning('*');

  try {
    // 1. Parse git log
    console.log('📋 Parsing git log...');
    const commits = getGitCommits(since);
    console.log(`   Found ${commits.length} commits touching tracked files`);

    if (commits.length === 0) {
      console.log('\nℹ️  No commits found. Nothing to sync.');
      await db('sync_log').where({ id: syncLogEntry.id }).update({
        status: 'COMPLETED',
        details: JSON.stringify({
          commits: 0,
          written: 0
        }),
        completed_at: new Date().toISOString(),
      });
      destroyConnection();
      return;
    }

    // 2. Build author → member mapping
    console.log('\n🔗 Building author mapping...');
    const authorMap = await buildAuthorMap(db);
    console.log(`   ${authorMap.size} alias entries loaded`);

    // 3. Auto-map unmapped authors by github_username / noreply email
    const autoMapped = await autoMapAuthors(db, commits, authorMap);
    if (autoMapped > 0) {
      console.log(`   ✅ Auto-mapped ${autoMapped} authors to members (saved as aliases)`);
    }

    // 4. Aggregate contributions
    const { aggregated, unmappedAuthors } = aggregateContributions(commits, authorMap);
    console.log(`   ${aggregated.size} daily contribution records to write`);

    if (unmappedAuthors.size > 0) {
      console.log(`\n⚠️  Unmapped authors (${unmappedAuthors.size}) — add git aliases via setup CLI:`);
      for (const author of unmappedAuthors) {
        console.log(`   - ${author}`);
      }
    }

    // 5. Fetch merged PR counts (best-effort)
    console.log('\n📦 Fetching merged PR counts...');
    const prCounts = await getMergedPRCounts(db, since);
    console.log(`   ${prCounts.size} PR records found`);

    // 6. Write to database
    console.log('\n💾 Writing contributions...');
    const written = await writeContributions(db, aggregated, prCounts);
    console.log(`   ✅ ${written} contribution records written`);

    // 7. Parse and write test case changes
    console.log('\n🔍 Parsing test case changes from git diffs...');
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    const tcWritten = await writeTestCaseChanges(db, commits, authorMap, repoRoot);
    console.log(`   ✅ ${tcWritten} test case change records written`);

    await db('sync_log').where({ id: syncLogEntry.id }).update({
      status: 'COMPLETED',
      details: JSON.stringify({
        commits: commits.length,
        written,
        auto_mapped: autoMapped,
        test_case_changes: tcWritten,
        unmapped: [...unmappedAuthors],
      }),
      completed_at: new Date().toISOString(),
    });

    console.log('\n===== Contribution Sync Completed =====\n');
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

syncContributions().catch(err => {
  console.error('Contribution sync failed:', err);
  process.exit(1);
});
