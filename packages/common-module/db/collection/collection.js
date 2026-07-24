import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentialsR3 = db.r3;

let dbConfig;

function getDb() {
  if (!dbConfig) {
    dbConfig = knex({
      ...dbCredentialsR3,
      pool: {
        min: 0,
        max: 2,
        idleTimeoutMillis: 10000,
        acquireTimeoutMillis: 10000
      }
    });
  }
  return dbConfig;
}

async function destroyConnection() {
  if (dbConfig) {
    await dbConfig.destroy();
    dbConfig = null;
  }
}

async function getEligibleAgreements(limit = 10, branch = 567) {
  const connection = getDb();

  const result = await connection.raw(`
    SELECT 
      a.agrmnt_no
    FROM agrmnt a
    JOIN agrmnt_asset aa
      ON a.agrmnt_id = aa.agrmnt_id
    WHERE a.contract_stat_code = 'LIV'
      AND aa.asset_stat_code = 'NOR'
      AND a.prepaid_hold_stat_code = 'NM'
      AND a.go_live_dt < CURRENT_DATE + INTERVAL '30 days'
      AND a.agrmnt_no LIKE '%${branch}%'
    ORDER BY a.go_live_dt DESC
    LIMIT ${limit}
  `);

  if (!result.rows || result.rows.length === 0) {
    throw new Error('No eligible agreements found');
  }

  return result.rows;
}

async function getBusinessDate() {
  const connection = getDb();

  const result = await connection.raw(`
    SELECT sys_value
    FROM sys_ctrl_coy
    WHERE sys_key = 'BusinessDate'
  `);

  if (!result.rows || result.rows.length === 0) {
    throw new Error('BusinessDate not found');
  }

  return result.rows[0].sys_value;
}

export {
  getEligibleAgreements,
  getBusinessDate,
  destroyConnection
};
