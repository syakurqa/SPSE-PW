import { wait } from '@common/utils/helpers/wait.js';
import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.kyc_sign;
const dbConfig = knex(dbCredentials);

async function checkOrInitConnection() {
  try {
    await dbConfig.raw('select * from references_information limit 1');
  } catch (err) {
    dbConfig.initialize();
  }
  return null;
}

async function getProcessID(referenceID, signType = 'CUSTOMER') {
  const result = await dbConfig.raw(
    `select process_id from sign_process
    WHERE reference_id = '${referenceID}'
    and sign_type ='${signType}'
    LIMIT 1;`
  );
  return result.rows;
}

async function getLinkKeyByWorkflowId(workflowId) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const result = await dbConfig.raw(
      `SELECT id, link_key FROM references_information WHERE reference_id = '${workflowId}' LIMIT 1;`
    );

    if (result.rows.length > 0) {
      return {
        referenceInformationId: result.rows[0].id,
        linkKey: result.rows[0].link_key,
      };
    }

    if (attempt === maxRetry) {
      throw new Error(`workflowId "${workflowId}" not found after ${maxRetry} retries`);
    }

    await wait(5000);
  }
}

async function updateReferenceStatus(referenceId, status) {
  await dbConfig('references_information')
    .where({ reference_id: referenceId })
    .update({ status });
}

async function updateLinkExpiredTime(referenceId, expiredTime) {
  await dbConfig('references_information')
    .where({ reference_id: referenceId })
    .update({ link_expired_time: expiredTime });
}

async function cleanupKycSignData(referenceId) {
  await dbConfig('sign_process').where({ reference_id: referenceId }).delete();
  await dbConfig('references_information').where({ reference_id: referenceId }).delete();
}

function destroyConnection() {
  dbConfig.destroy();
  return null;
}

export {
  checkOrInitConnection,
  destroyConnection,
  getProcessID,
  getLinkKeyByWorkflowId,
  cleanupKycSignData,
  updateReferenceStatus,
  updateLinkExpiredTime,
};
