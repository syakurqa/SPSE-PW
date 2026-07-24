import { db } from '@common/config/index.js';
import knex from 'knex';

const dbCredentials = db.notification;
const dbConfig = knex(dbCredentials);

function destroyConnection() {
  dbConfig.destroy();
  return null;
}

async function rawQuery(query) {
  const result = await dbConfig.raw(query);
  return result.rows;
}

/**
 * Get vendor_log record by message_id
 * @param {string} messageId
 * @returns {Promise<Object|null>}
 */
async function getVendorLogByMessageId(messageId) {
  const result = await dbConfig.raw(
    'SELECT id, message_id, vendor_name, vendor_message_id FROM vendor_log WHERE message_id = ? LIMIT 1',
    [messageId],
  );
  return result.rows[0] ?? null;
}

export {
  destroyConnection,
  rawQuery,
  getVendorLogByMessageId,
};
