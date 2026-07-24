
import axios from 'axios';
import { generateUUID } from '../helpers/random.js';
import ZephyrAPI from './zephyr-api.js';
import { RateLimiter } from './rate-limiter.js';

// Create a singleton rate limiter instance for Google Chat API
const googleChatRateLimiter = new RateLimiter(1, 1);

/**
 * Send notification to Google Chat with automatic rate limiting and retry logic
 *
 * Features:
 * - Rate limited to 1 request per 1 second (Google Chat API limit)
 * - Automatic retry with exponential backoff on 429 errors (max 5 retries)
 * - Sends message card with test results and optional user mentions
 *
 * @param {Object} options - Notification options
 * @param {string} options.webhookUrl - Google Chat webhook URL
 * @param {string} options.testEnvironment - Test environment (SIT/UAT)
 * @param {string} options.workspaceType - Workspace type (api/web)
 * @param {string} options.actor - GitHub actor who triggered the workflow
 * @param {string} options.keyword - Search keyword
 * @param {string} options.runNumber - GitHub run number
 * @param {string} options.runAttempt - GitHub run attempt
 * @param {string} options.branchName - Git branch name
 * @param {Object} options.testSummary - Test summary from test-cycle-summary.env
 * @param {string} options.testSummary.total - Total tests executed
 * @param {string} options.testSummary.pass - Total passed tests
 * @param {string} options.testSummary.fail - Total failed tests
 * @param {Object} options.testCycles - Test cycle info (keys and links)
 * @param {Array<string>} options.groups - List of group names
 * @param {Array<string>} options.mentions - List of user IDs to mention (e.g., ['1234567890'])
 * @param {string} options.scheduler - Scheduler flag ('true' for scheduler mode)
 * @param {string} [options.reportLabel] - Optional label to identify the report (e.g. device build name for mobile)
 * @param {Array} [options.subReports] - Optional per-report breakdown: [{label, summary, cycleKey, cycleLink}]
 * @returns {Promise<{success: boolean}>} Success status
 * @throws {Error} If notification fails after retries
 */
export async function automationReportNotif({
  webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL,
  testEnvironment = process.env.ENV,
  workspaceType = process.env.WORKSPACE_TYPE,
  actor = process.env.GITHUB_ACTOR,
  keyword = process.env.KEYWORD,
  runNumber = process.env.GITHUB_RUN_NUMBER,
  runAttempt = process.env.GITHUB_RUN_ATTEMPT,
  branchName = process.env.GITHUB_REF_NAME,
  testSummary = {
    total: 'N/A',
    pass: 'N/A',
    fail: 'N/A'
  },
  testCycles = {},
  squadName,
  mentions,
  scheduler = process.env.SCHEDULER,
  reportLabel = null,
  subReports = null
}) {

  const threadKey = generateUUID();

  // Build sections — multi-report layout when subReports array is provided
  const hasSubReports = Array.isArray(subReports) && subReports.length > 0;

  // Section 1: run metadata + grand total summary
  const metaSection = {
    widgets: [
      { textParagraph: { text: `<b>👤 Triggered by:</b> ${actor}` } },
      {
        keyValue: {
          topLabel: 'Total',
          content: testSummary.total
        }
      },
      {
        keyValue: {
          topLabel: 'Passed',
          content: testSummary.pass
        }
      },
      {
        keyValue: {
          topLabel: 'Failed',
          content: testSummary.fail
        }
      },
      {
        keyValue: {
          topLabel: 'Environment',
          content: testEnvironment
        }
      },
      {
        keyValue: {
          topLabel: 'Keyword',
          content: keyword ?? 'N/A'
        }
      },
      {
        keyValue: {
          topLabel: 'Run Number',
          content: `#${runNumber} (Attempt ${runAttempt})`
        }
      },
      {
        keyValue: {
          topLabel: 'Branch',
          content: branchName
        }
      }
    ]
  };

  // Per-report breakdown sections
  const subReportSections = hasSubReports
    ? subReports.map((r, i) => ({
      header: `Report ${i + 1}`,
      widgets: [
        { textParagraph: { text: `<b>${r.label}</b>` } },
        {
          keyValue: {
            topLabel: 'Pass',
            content: String(r.summary.pass)
          }
        },
        {
          keyValue: {
            topLabel: 'Fail',
            content: String(r.summary.fail)
          }
        },
        {
          keyValue: {
            topLabel: 'Total',
            content: String(r.summary.total)
          }
        },
        {
          buttons: [{
            textButton: {
              text: `Open Test Cycle ${r.cycleKey}`,
              onClick: { openLink: { url: r.cycleLink } }
            }
          }]
        }
      ]
    }))
    : [];

  // Action section: pipeline link + (single-report) test cycle link
  const actionButtons = [
    {
      textButton: {
        text: 'View Pipeline Details',
        onClick: { openLink: { url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` } }
      }
    }
  ];
  if (!hasSubReports) {
    actionButtons.push({
      textButton: {
        text: `Open ${squadName} Test Cycle`,
        onClick: { openLink: { url: testCycles.link } }
      }
    });
  }

  // Create message payload
  const message = {
    thread: { threadKey: threadKey },
    cards: [
      {
        header: {
          title: `🧪 Test Automation Results - [${testEnvironment}][${workspaceType.toUpperCase()}]`,
          subtitle: reportLabel ? `${squadName} · ${reportLabel}` : `${squadName}`
        },
        sections: [
          metaSection,
          ...subReportSections,
          { widgets: [{ buttons: actionButtons }] }
        ]
      }
    ]
  };

  // Send to Google Chat
  try {
    await sendChat(webhookUrl, message);
    if (Array.isArray(mentions) && mentions.length > 0) {
      let mention = `<users/${findUserById(actor)}>`;
      if (scheduler === 'true') {
        mention = mentions.length > 0 ? mentions.map(userId => `<users/${userId}>`).join(' ') : '';
      }
      const replyThreadMessage = {
        thread: { threadKey: threadKey },
        text: mention
      };
      await sendChat(webhookUrl, replyThreadMessage);
    }

    // eslint-disable-next-line no-console
    console.log('✅ Google Chat notification sent successfully');
    return { success: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to send Google Chat notification:', error.message);
    throw error;
  }
}

/**
 * Find Google Chat user ID by username from Zephyr squad configuration
 * @param {string} username - GitHub username to lookup
 * @returns {string} Google Chat user ID
 */
function findUserById(username) {
  const config = ZephyrAPI.getAllProject();
  for (const squad of config) {
    if (squad.members && squad.members[username]) {
      return squad.members[username];
    }
  }
  return findUserById('dony-syahputra');
}

/**
 * Send message to Google Chat with rate limiting and retry logic
 *
 * Features:
 * - Rate limited: 1 request per 1 second
 * - Automatic retry on 429 errors with exponential backoff (max 5 retries)
 * - Retry delays: 1s → 2s → 4s → 8s → 10s (max)
 *
 * @param {string} webhookUrl - Google Chat webhook URL
 * @param {Object} payload - Message payload to send
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<void>}
 * @throws {Error} If request fails after max retries
 */
async function sendChat(webhookUrl, payload, retryCount = 0) {
  await googleChatRateLimiter.waitForAvailability('Google Chat API');

  try {
    await axios.post(webhookUrl, payload);
  } catch (error) {
    // Handle 429 rate limit errors with exponential backoff
    if (error.response?.status === 429 && retryCount < 5) {
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s
      // eslint-disable-next-line no-console
      console.warn(`[Google Chat] Rate limited. Retrying in ${backoffTime}ms... (attempt ${retryCount + 1}/5)`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return sendChat(webhookUrl, payload, retryCount + 1);
    }
    throw error;
  }
}
