/* eslint-disable no-console */
/**
 * Interactive Platform Setup CLI
 *
 * Manage platforms, squads, and ownership configuration interactively.
 * Allows leads to set up the correct zephyr_test_cycle_folder_id for coverage sync.
 *
 * Usage: npm run setup --workspace=@automation/reporting-module
 */

import {
  input, select, confirm, Separator
} from '@inquirer/prompts';
import { spawn } from 'node:child_process';
import { getConnection, destroyConnection } from '../lib/database.js';
import { getFolders } from '../lib/zephyr-api.js';

function printTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length))
  );

  console.log(headers.map((h, i) => h.padEnd(widths[i])).join('  '));
  console.log(widths.map(w => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(row.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  '));
  }
}

async function listPlatforms(db) {
  const rows = await db('platforms AS p')
    .leftJoin('squad_platform_ownership AS spo', function () {
      this.on('p.id', 'spo.platform_id').andOnNull('spo.effective_to');
    })
    .leftJoin('squads AS s', 's.id', 'spo.squad_id')
    .where('p.is_active', true)
    .select(
      'p.id',
      'p.platform_name',
      'p.platform_type',
      'p.zephyr_test_cycle_folder_id',
      'p.zephyr_project_key',
      's.squad_name'
    )
    .orderBy('s.squad_name')
    .orderBy('p.platform_name');

  console.log(`\n📋 Platforms (${rows.length} total)\n`);
  printTable(
    ['ID', 'Platform', 'Type', 'Folder ID', 'Project', 'Owner'],
    rows.map(r => [
      r.id,
      r.platform_name,
      r.platform_type,
      r.zephyr_test_cycle_folder_id || '⚠️  NOT SET',
      r.zephyr_project_key || '-',
      r.squad_name || '-',
    ])
  );
  console.log('');
}

async function addPlatform(db) {
  const squads = await db('squads').where({ is_active: true }).orderBy('squad_name');

  if (squads.length === 0) {
    console.log('⚠️  No squads found. Run seed first.');
    return;
  }

  const platformName = await input({ message: 'Platform name:' });

  const platformType = await select({
    message: 'Platform type:',
    choices: [
      {
        name: 'PLATFORM',
        value: 'PLATFORM'
      },
      {
        name: 'SERVICE',
        value: 'SERVICE'
      },
    ],
  });

  const squadId = await select({
    message: 'Owner squad:',
    choices: squads.map(s => ({
      name: `${s.squad_name} (${s.zephyr_key})${s.jira_key && s.jira_key !== s.zephyr_key ? ` jira:${s.jira_key}` : ''}`,
      value: s.id
    })),
  });

  const squad = squads.find(s => s.id === squadId);

  const projectKey = await input({
    message: 'Zephyr project key:',
    default: squad.zephyr_key,
  });

  const folderIdStr = await input({ message: 'Zephyr test cycle folder ID (leave empty to set later):', });
  const folderId = folderIdStr ? parseInt(folderIdStr, 10) : null;

  const [platform] = await db('platforms')
    .insert({
      platform_name: platformName,
      platform_type: platformType,
      zephyr_test_cycle_folder_id: folderId,
      zephyr_project_key: projectKey,
      is_active: true,
    })
    .returning('*');

  const today = new Date().toISOString().split('T')[0];
  await db('squad_platform_ownership').insert({
    squad_id: squadId,
    platform_id: platform.id,
    effective_from: today,
  });

  console.log(`\n✅ Platform created: ${platform.platform_name} (ID: ${platform.id})`);
  console.log(`   Owner: ${squad.squad_name}`);
  console.log(`   Folder ID: ${folderId || 'Not set'}\n`);
}

async function updatePlatformFolderId(db) {
  const platforms = await db('platforms')
    .where({ is_active: true })
    .orderBy('platform_name');

  if (platforms.length === 0) {
    console.log('⚠️  No platforms found.');
    return;
  }

  const platformId = await select({
    message: 'Select platform to update:',
    choices: platforms.map(p => ({
      name: `${p.platform_name} (current folder: ${p.zephyr_test_cycle_folder_id || 'NOT SET'})`,
      value: p.id,
    })),
  });

  const platform = platforms.find(p => p.id === platformId);

  const browseFolders = await confirm({
    message: `Browse Zephyr folders for ${platform.zephyr_project_key}?`,
    default: true,
  });

  let folderId;

  if (browseFolders && platform.zephyr_project_key) {
    try {
      console.log(`\n🔍 Fetching folders for ${platform.zephyr_project_key}...\n`);
      const folders = await getFolders(platform.zephyr_project_key);

      const rootFolders = folders.filter(f => !f.parentId);

      if (rootFolders.length === 0) {
        console.log('No root folders found.');
      } else {
        await browseFolderTree(folders, rootFolders, null);
      }
    } catch (err) {
      console.log(`⚠️  Could not fetch folders: ${err.message}`);
    }

    const folderIdStr = await input({ message: 'Enter the folder ID from above (or type manually):', });
    folderId = folderIdStr ? parseInt(folderIdStr, 10) : null;
  } else {
    const folderIdStr = await input({ message: 'Enter Zephyr test cycle folder ID:', });
    folderId = folderIdStr ? parseInt(folderIdStr, 10) : null;
  }

  if (!folderId) {
    console.log('⚠️  No folder ID provided. Skipping update.');
    return;
  }

  await db('platforms')
    .where({ id: platformId })
    .update({
      zephyr_test_cycle_folder_id: folderId,
      updated_at: new Date().toISOString(),
    });

  console.log(`\n✅ Updated ${platform.platform_name} → folder ID: ${folderId}\n`);
}

async function browseFolderTree(allFolders, currentFolders, parentName) {
  const indent = parentName ? '  ' : '';
  const label = parentName || 'Root';

  console.log(`${indent}📁 ${label}`);
  for (const folder of currentFolders) {
    const children = allFolders.filter(f => f.parentId === folder.id);
    const childCount = children.length > 0 ? ` (${children.length} sub-folders)` : '';
    console.log(`${indent}  ├── [${folder.id}] ${folder.name}${childCount}`);
  }

  const expandChoice = await confirm({
    message: `Expand a sub-folder under ${label}?`,
    default: false,
  });

  if (expandChoice) {
    const folderId = await select({
      message: 'Select folder to expand:',
      choices: currentFolders
        .filter(f => allFolders.some(c => c.parentId === f.id))
        .map(f => ({
          name: `[${f.id}] ${f.name}`,
          value: f.id
        })),
    });

    const children = allFolders.filter(f => f.parentId === folderId);
    const selected = currentFolders.find(f => f.id === folderId);
    await browseFolderTree(allFolders, children, selected.name);
  }
}

async function editPlatform(db) {
  const platforms = await db('platforms')
    .where({ is_active: true })
    .orderBy('platform_name');

  if (platforms.length === 0) {
    console.log('⚠️  No platforms found.');
    return;
  }

  const platformId = await select({
    message: 'Select platform to edit:',
    choices: platforms.map(p => ({
      name: `${p.platform_name} (${p.platform_type})`,
      value: p.id,
    })),
  });

  const platform = platforms.find(p => p.id === platformId);

  const newName = await input({
    message: 'Platform name:',
    default: platform.platform_name,
  });

  const newType = await select({
    message: 'Platform type:',
    choices: [
      {
        name: 'PLATFORM',
        value: 'PLATFORM'
      },
      {
        name: 'SERVICE',
        value: 'SERVICE'
      },
    ],
    default: platform.platform_type,
  });

  const newProjectKey = await input({
    message: 'Zephyr project key:',
    default: platform.zephyr_project_key || '',
  });

  await db('platforms')
    .where({ id: platformId })
    .update({
      platform_name: newName,
      platform_type: newType,
      zephyr_project_key: newProjectKey || null,
      updated_at: new Date().toISOString(),
    });

  console.log(`\n✅ Platform updated: ${newName}\n`);
}

async function deactivatePlatform(db) {
  const platforms = await db('platforms')
    .where({ is_active: true })
    .orderBy('platform_name');

  const platformId = await select({
    message: 'Select platform to deactivate:',
    choices: platforms.map(p => ({
      name: `${p.platform_name} (${p.platform_type})`,
      value: p.id,
    })),
  });

  const platform = platforms.find(p => p.id === platformId);

  const confirmed = await confirm({
    message: `Deactivate "${platform.platform_name}"? It will be excluded from coverage sync.`,
    default: false,
  });

  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  await db('platforms').where({ id: platformId }).update({
    is_active: false,
    updated_at: new Date().toISOString(),
  });

  console.log(`\n✅ Deactivated: ${platform.platform_name}\n`);
}

async function listSquads(db) {
  const squads = await db('squads').where({ is_active: true }).orderBy('squad_name');

  console.log(`\n📋 Squads (${squads.length} total)\n`);
  printTable(
    ['ID', 'Squad', 'Zephyr Key', 'Jira Key', 'Status: Automated', 'Status: Need Maint.'],
    squads.map(s => [
      s.id,
      s.squad_name,
      s.zephyr_key,
      s.jira_key || '⚠️  NOT SET',
      s.zephyr_status_automated || '⚠️  NOT SET',
      s.zephyr_status_need_maintenance || '⚠️  NOT SET',
    ])
  );
  console.log('');
}

// --- Member Management ---

async function addSquad(db) {
  const squadName = await input({ message: 'Squad name:' });
  const zephyrKey = await input({ message: 'Zephyr project key:' });
  const jiraKey = await input({
    message: 'Jira project key (leave empty to use Zephyr key):',
    default: zephyrKey,
  });

  const statusAutomatedStr = await input({
    message: 'Zephyr status ID for "Automated" (leave empty to set later):',
    default: '',
  });
  const statusMaintenanceStr = await input({
    message: 'Zephyr status ID for "Need Maintenance" (leave empty to set later):',
    default: '',
  });

  const [squad] = await db('squads')
    .insert({
      squad_name: squadName,
      zephyr_key: zephyrKey,
      jira_key: jiraKey,
      zephyr_status_automated: statusAutomatedStr ? parseInt(statusAutomatedStr, 10) : null,
      zephyr_status_need_maintenance: statusMaintenanceStr ? parseInt(statusMaintenanceStr, 10) : null,
      is_active: true,
    })
    .returning('*');

  console.log(`\n✅ Squad created: ${squad.squad_name} (Zephyr: ${squad.zephyr_key}, Jira: ${squad.jira_key})`);
  console.log(`   Automated Status ID: ${squad.zephyr_status_automated || 'Not set'}`);
  console.log(`   Need Maintenance Status ID: ${squad.zephyr_status_need_maintenance || 'Not set'}\n`);
}

async function editSquad(db) {
  const squads = await db('squads').where({ is_active: true }).orderBy('squad_name');

  if (squads.length === 0) {
    console.log('⚠️  No squads found.');
    return;
  }

  const squadId = await select({
    message: 'Select squad to edit:',
    choices: squads.map(s => ({
      name: `${s.squad_name} (${s.zephyr_key})${s.jira_key && s.jira_key !== s.zephyr_key ? ` jira:${s.jira_key}` : ''}`,
      value: s.id,
    })),
  });

  const squad = squads.find(s => s.id === squadId);

  const newName = await input({
    message: 'Squad name:',
    default: squad.squad_name,
  });
  const newKey = await input({
    message: 'Zephyr project key:',
    default: squad.zephyr_key || '',
  });
  const newJiraKey = await input({
    message: 'Jira project key:',
    default: squad.jira_key || '',
  });
  const newAutomated = await input({
    message: 'Zephyr status ID for "Automated":',
    default: squad.zephyr_status_automated ? String(squad.zephyr_status_automated) : '',
  });
  const newMaintenance = await input({
    message: 'Zephyr status ID for "Need Maintenance":',
    default: squad.zephyr_status_need_maintenance ? String(squad.zephyr_status_need_maintenance) : '',
  });

  await db('squads')
    .where({ id: squadId })
    .update({
      squad_name: newName,
      zephyr_key: newKey || null,
      jira_key: newJiraKey || null,
      zephyr_status_automated: newAutomated ? parseInt(newAutomated, 10) : null,
      zephyr_status_need_maintenance: newMaintenance ? parseInt(newMaintenance, 10) : null,
      updated_at: new Date().toISOString(),
    });

  console.log(`\n✅ Squad updated: ${newName} (Jira key: ${newJiraKey})\n`);
}

async function listMembers(db) {
  const rows = await db('members')
    .where('is_active', true)
    .select('id', 'member_name', 'email', 'github_username')
    .orderBy('member_name');

  console.log(`\n👥 Members (${rows.length} total)\n`);
  printTable(
    ['ID', 'Name', 'Email', 'GitHub'],
    rows.map(r => [
      r.id,
      r.member_name,
      r.email || '-',
      r.github_username || '-',
    ])
  );
  console.log('');
}

async function addMember(db) {
  const memberName = await input({ message: 'Member name:' });
  const email = await input({
    message: 'Email (optional):',
    default: ''
  });
  const githubUsername = await input({ message: 'GitHub username:' });

  const [member] = await db('members')
    .insert({
      member_name: memberName,
      email: email || null,
      github_username: githubUsername || null,
      is_active: true,
    })
    .returning('*');

  // Auto-create a git alias from the github username
  if (githubUsername) {
    await db('member_git_aliases')
      .insert({
        member_id: member.id,
        git_author_name: githubUsername,
        git_author_email: null,
      })
      .onConflict(['git_author_name', 'git_author_email'])
      .ignore();
  }

  console.log(`\n✅ Member added: ${member.member_name} (ID: ${member.id})`);

  const addAlias = await confirm({
    message: 'Add git aliases now? (you can add them later too)',
    default: true,
  });

  if (addAlias) {
    await manageGitAliases(db, member);
  }
}

async function editMember(db) {
  const members = await db('members')
    .where({ is_active: true })
    .orderBy('member_name');

  if (members.length === 0) {
    console.log('⚠️  No members found.');
    return;
  }

  const memberId = await select({
    message: 'Select member to edit:',
    choices: members.map(m => ({
      name: `${m.member_name} (@${m.github_username || '?'})`,
      value: m.id,
    })),
  });

  const member = members.find(m => m.id === memberId);

  const newName = await input({
    message: 'Name:',
    default: member.member_name
  });
  const newEmail = await input({
    message: 'Email:',
    default: member.email || ''
  });
  const newGithub = await input({
    message: 'GitHub username:',
    default: member.github_username || ''
  });

  await db('members')
    .where({ id: memberId })
    .update({
      member_name: newName,
      email: newEmail || null,
      github_username: newGithub || null,
      updated_at: new Date().toISOString(),
    });

  console.log(`\n✅ Member updated: ${newName}\n`);
}

async function manageGitAliases(db, memberOverride) {
  let member = memberOverride;

  if (!member) {
    const members = await db('members').where({ is_active: true }).orderBy('member_name');

    if (members.length === 0) {
      console.log('⚠️  No members found.');
      return;
    }

    const memberId = await select({
      message: 'Select member:',
      choices: members.map(m => ({
        name: `${m.member_name} (@${m.github_username || '?'})`,
        value: m.id,
      })),
    });

    member = members.find(m => m.id === memberId);
  }

  // Show existing aliases
  const aliases = await db('member_git_aliases')
    .where({ member_id: member.id })
    .orderBy('git_author_name');

  if (aliases.length > 0) {
    console.log(`\n📝 Current git aliases for ${member.member_name}:\n`);
    printTable(
      ['ID', 'Git Author Name', 'Git Author Email'],
      aliases.map(a => [a.id, a.git_author_name || '-', a.git_author_email || '-'])
    );
    console.log('');
  } else {
    console.log(`\nNo git aliases configured for ${member.member_name}.\n`);
  }

  let addMore = true;
  while (addMore) {
    const gitName = await input({ message: 'Git author name (as it appears in git log):', });

    const gitEmail = await input({
      message: 'Git author email (optional):',
      default: '',
    });

    try {
      await db('member_git_aliases').insert({
        member_id: member.id,
        git_author_name: gitName || null,
        git_author_email: gitEmail || null,
      });
      console.log(`   ✅ Alias added: "${gitName}" <${gitEmail || 'any'}>`);
    } catch (err) {
      if (err.code === '23505') {
        console.log('   ⚠️  This alias already exists.');
      } else {
        throw err;
      }
    }

    addMore = await confirm({
      message: 'Add another alias?',
      default: false
    });
  }
}

async function deactivateMember(db) {
  const members = await db('members')
    .where({ is_active: true })
    .orderBy('member_name');

  if (members.length === 0) {
    console.log('⚠️  No members found.');
    return;
  }

  const memberId = await select({
    message: 'Select member to deactivate:',
    choices: members.map(m => ({
      name: `${m.member_name} (@${m.github_username || '?'})`,
      value: m.id,
    })),
  });

  const member = members.find(m => m.id === memberId);

  const confirmed = await confirm({
    message: `Deactivate "${member.member_name}"? Their contributions will be preserved but no new data will be collected.`,
    default: false,
  });

  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  await db('members').where({ id: memberId }).update({
    is_active: false,
    updated_at: new Date().toISOString(),
  });

  console.log(`\n✅ Deactivated: ${member.member_name}\n`);
}

// --- Ownership Management ---

async function listCurrentOwnership(db) {
  const rows = await db('squad_platform_ownership AS spo')
    .join('squads AS s', 's.id', 'spo.squad_id')
    .join('platforms AS p', 'p.id', 'spo.platform_id')
    .whereNull('spo.effective_to')
    .select(
      'spo.id',
      's.squad_name',
      'p.platform_name',
      'p.platform_type',
      'spo.effective_from'
    )
    .orderBy('s.squad_name');

  console.log(`\n📋 Current Platform Ownership (${rows.length} total)\n`);
  printTable(
    ['ID', 'Squad', 'Platform', 'Type', 'Since'],
    rows.map(r => [
      r.id,
      r.squad_name,
      r.platform_name,
      r.platform_type,
      r.effective_from.toISOString().split('T')[0],
    ])
  );
  console.log('');
}

async function transferOwnership(db) {
  const currentOwnership = await db('squad_platform_ownership AS spo')
    .join('squads AS s', 's.id', 'spo.squad_id')
    .join('platforms AS p', 'p.id', 'spo.platform_id')
    .whereNull('spo.effective_to')
    .select('spo.id', 'spo.squad_id', 'spo.platform_id', 's.squad_name', 'p.platform_name')
    .orderBy('p.platform_name');

  if (currentOwnership.length === 0) {
    console.log('⚠️  No active ownership records found.');
    return;
  }

  const selectedId = await select({
    message: 'Select platform to transfer:',
    choices: currentOwnership.map(o => ({
      name: `${o.platform_name} (owned by: ${o.squad_name})`,
      value: o.id,
    })),
  });

  const current = currentOwnership.find(o => o.id === selectedId);

  const squads = await db('squads')
    .where({ is_active: true })
    .whereNot({ id: current.squad_id })
    .orderBy('squad_name');

  if (squads.length === 0) {
    console.log('⚠️  No other squads available for transfer.');
    return;
  }

  const toSquadId = await select({
    message: 'Transfer to which squad?',
    choices: squads.map(s => ({
      name: `${s.squad_name} (${s.zephyr_key})${s.jira_key && s.jira_key !== s.zephyr_key ? ` jira:${s.jira_key}` : ''}`,
      value: s.id,
    })),
  });

  const effectiveDate = await input({
    message: 'Effective date (YYYY-MM-DD):',
    default: new Date().toISOString().split('T')[0],
  });

  const confirmed = await confirm({
    message: `Transfer "${current.platform_name}" from ${current.squad_name} to ${squads.find(s => s.id === toSquadId).squad_name}?`,
    default: false,
  });

  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  await db('squad_platform_ownership')
    .where({ id: current.id })
    .update({ effective_to: effectiveDate });

  await db('squad_platform_ownership').insert({
    squad_id: toSquadId,
    platform_id: current.platform_id,
    effective_from: effectiveDate,
  });

  const toSquad = squads.find(s => s.id === toSquadId);
  console.log(`\n✅ Ownership transferred: ${current.platform_name}`);
  console.log(`   From: ${current.squad_name} → To: ${toSquad.squad_name}`);
  console.log(`   Effective: ${effectiveDate}\n`);
}

async function showOwnershipHistory(db) {
  const platforms = await db('platforms')
    .where({ is_active: true })
    .orderBy('platform_name');

  if (platforms.length === 0) {
    console.log('⚠️  No platforms found.');
    return;
  }

  const platformId = await select({
    message: 'Select platform to view history:',
    choices: platforms.map(p => ({
      name: p.platform_name,
      value: p.id,
    })),
  });

  const platform = platforms.find(p => p.id === platformId);

  const rows = await db('squad_platform_ownership AS spo')
    .join('squads AS s', 's.id', 'spo.squad_id')
    .where('spo.platform_id', platformId)
    .select('s.squad_name', 'spo.effective_from', 'spo.effective_to')
    .orderBy('spo.effective_from');

  if (rows.length === 0) {
    console.log(`No ownership history for ${platform.platform_name}`);
    return;
  }

  console.log(`\n📜 Ownership History: ${platform.platform_name}\n`);
  printTable(
    ['Squad', 'From', 'To'],
    rows.map(r => [
      r.squad_name,
      r.effective_from.toISOString().split('T')[0],
      r.effective_to ? r.effective_to.toISOString().split('T')[0] : '(current)',
    ])
  );
  console.log('');
}

/**
 * Trigger Jira issue sync as a child process.
 */
async function triggerJiraSync() {
  const mode = await select({
    message: 'Jira issue sync mode:',
    choices: [
      {
        name: '🔄 Incremental (since last sync)',
        value: 'incremental'
      },
      {
        name: '📅 Since a specific date',
        value: 'since'
      },
      {
        name: '🔁 Full sync (re-fetch all, prune deleted)',
        value: 'full'
      },
    ],
  });

  const script = 'reporting-sync/jira-issue-sync.js';
  const nodeArgs = [script];
  if (mode === 'full') {
    nodeArgs.push('--full');
  } else if (mode === 'since') {
    const dateStr = await input({
      message: 'Start date (YYYY-MM-DD or ISO datetime):',
      default: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    });
    nodeArgs.push('--since', dateStr);
  }

  console.log(`\n🚀 Running: node ${nodeArgs.join(' ')}\n`);

  return new Promise((resolve, _reject) => {
    const child = spawn('node', nodeArgs, {
      cwd: new URL('..', import.meta.url).pathname,
      stdio: 'inherit',
    });
    child.on('close', code => {
      if (code === 0) {
        console.log('\n✅ Jira issue sync completed.\n');
        resolve();
      } else {
        console.log(`\n❌ Jira issue sync exited with code ${code}\n`);
        resolve(); // don't crash the menu
      }
    });
    child.on('error', err => {
      console.error(`\n⚠️  Failed to start sync: ${err.message}\n`);
      resolve();
    });
  });
}

async function mainMenu(db) {
  let running = true;

  while (running) {
    const action = await select({
      message: 'What would you like to do?',
      choices: [
        {
          name: '📋 List platforms',
          value: 'list-platforms'
        },
        {
          name: '📋 List squads',
          value: 'list-squads'
        },
        {
          name: '➕ Add squad',
          value: 'add-squad'
        },
        {
          name: '✏️  Edit squad',
          value: 'edit-squad'
        },
        {
          name: '➕ Add platform',
          value: 'add-platform'
        },
        {
          name: '🔧 Set folder ID for platform',
          value: 'set-folder-id'
        },
        {
          name: '✏️  Edit platform',
          value: 'edit-platform'
        },
        {
          name: '🗑️  Deactivate platform',
          value: 'deactivate-platform'
        },
        new Separator(),
        {
          name: '📋 List ownership',
          value: 'list-ownership'
        },
        {
          name: '🔄 Transfer ownership',
          value: 'transfer-ownership'
        },
        {
          name: '📜 Ownership history',
          value: 'ownership-history'
        },
        new Separator(),
        {
          name: '🔄 Trigger Jira issue sync',
          value: 'trigger-jira-sync'
        },
        new Separator(),
        {
          name: '👥 List members',
          value: 'list-members'
        },
        {
          name: '👤 Add member',
          value: 'add-member'
        },
        {
          name: '✏️  Edit member',
          value: 'edit-member'
        },
        {
          name: '🔗 Manage git aliases',
          value: 'manage-git-aliases'
        },
        {
          name: '🗑️  Deactivate member',
          value: 'deactivate-member'
        },
        new Separator(),
        {
          name: '🚪 Exit',
          value: 'exit'
        },
      ],
    });

    switch (action) {
    case 'list-platforms':
      await listPlatforms(db);
      break;
    case 'list-squads':
      await listSquads(db);
      break;
    case 'add-squad':
      await addSquad(db);
      break;
    case 'edit-squad':
      await editSquad(db);
      break;
    case 'add-platform':
      await addPlatform(db);
      break;
    case 'set-folder-id':
      await updatePlatformFolderId(db);
      break;
    case 'edit-platform':
      await editPlatform(db);
      break;
    case 'deactivate-platform':
      await deactivatePlatform(db);
      break;
    case 'list-ownership':
      await listCurrentOwnership(db);
      break;
    case 'transfer-ownership':
      await transferOwnership(db);
      break;
    case 'ownership-history':
      await showOwnershipHistory(db);
      break;
    case 'trigger-jira-sync':
      await triggerJiraSync();
      break;
    case 'list-members':
      await listMembers(db);
      break;
    case 'add-member':
      await addMember(db);
      break;
    case 'edit-member':
      await editMember(db);
      break;
    case 'manage-git-aliases':
      await manageGitAliases(db);
      break;
    case 'deactivate-member':
      await deactivateMember(db);
      break;
    case 'exit':
      running = false;
      break;
    }
  }
}

async function main() {
  console.log('\n🔧 Reporting Module — Platform Setup\n');
  const db = getConnection();

  try {
    await mainMenu(db);
  } finally {
    destroyConnection();
  }

  console.log('Bye! 👋\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  destroyConnection();
  process.exit(1);
});
