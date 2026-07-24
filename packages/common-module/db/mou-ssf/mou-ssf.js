import { wait } from '@common/utils/helpers/wait.js';
import { Database } from 'arangojs';
import { db } from '@common/config/index.js';

const databaseConnection = new Database({
  url: db.mou_ssf.url,
  databaseName: db.mou_ssf.databaseName,
  auth: {
    username: db.mou_ssf.auth.username,
    password: db.mou_ssf.auth.password,
  },
});

const databaseConnectionLoraLts = new Database({
  url: db.bfi_db_lora_lts.url,
  databaseName: db.bfi_db_lora_lts.databaseName,
  auth: {
    username: db.bfi_db_lora_lts.auth.username,
    password: db.bfi_db_lora_lts.auth.password,
  },
});

function destroyConnection() {
  databaseConnection.destroy();
  databaseConnectionLoraLts.destroy();
  return null;
}

async function checkerWorkflowIdByMouApplicationId({ mouApplicationId }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    await wait(8000);
    const cursor = await databaseConnection.query(`
      FOR doc IN doc_pending
      FILTER doc._key == "${mouApplicationId}"
      RETURN doc.data
    `);
    const result = await cursor.all();

    const validResults = result.filter(Boolean);

    if (validResults.length > 0) {
      return validResults;
    }

    if (attempt === maxRetry) {
      throw new Error(`mou_application_id "${mouApplicationId}" not found after ${maxRetry} retries`);
    }

    await wait(8000);
  }
}

async function checkerTaskByMouApplicationId({ mouApplicationId, taskStatus }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const cursor = await databaseConnectionLoraLts.query(`
      FOR doc IN task
      FILTER doc.document_id == "${mouApplicationId}"
      AND doc.type == "${taskStatus}"
      RETURN doc
    `);
    const result = await cursor.all();

    if (result.length > 0) {
      return result;
    }

    if (attempt === maxRetry) {
      throw new Error(`mou_application_id "${mouApplicationId}" not found after ${maxRetry} retries`);
    }

    await wait(5000);
  }
}

async function checkerPoaStatusByWorkflowId({ workflowId }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const cursor = await databaseConnection.query(`
   FOR doc IN doc_pending_internal
    FILTER doc._key == "${workflowId}"
    FOR s IN doc.fields["$.process.signing_followup.poa.status"].value.succ
    RETURN s.Value.Value
    `);
    const result = await cursor.all();

    if (result[0] === 'process') {
      return result;
    }

    if (attempt === maxRetry) {
      throw new Error(`workflowId "${workflowId}" with POA status "process" not found after ${maxRetry} retries`);
    }

    await wait(5000);
  }
}

async function checkerRejectStatusByWorkflowId({ workflowId }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const cursor = await databaseConnection.query(`
      FOR doc IN doc_pending_internal
        FILTER doc._key == "${workflowId}"
        RETURN doc.fields["$.status.application"].value.succ[2].Value.Value
    `);

    const result = await cursor.all();

    if (result[0] === 'rejected') {
      return result;
    }

    if (attempt === maxRetry) {
      throw new Error(
        `workflowId "${workflowId}" with status "rejected" not found after ${maxRetry} retries`
      );
    }

    await wait(5000);
  }
}

async function checkerConsentDocumentIdByWorkflowId({ workflowId }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const cursor = await databaseConnection.query(`
      FOR doc IN doc_pending_internal
      FILTER doc._key == "${workflowId}"
      FOR s IN doc.fields["$.process.consent.document_id"].value.succ
      RETURN s.Value.Value
    `);
    const result = await cursor.all();

    if (result.length > 0) {
      return result[0];
    }

    if (attempt === maxRetry) {
      throw new Error(`workflowId "${workflowId}" consent document_id not found after ${maxRetry} retries`);
    }

    await wait(5000);
  }
}

async function checkerCreditCheckingCompletedByMouApplicationId({ mouApplicationId }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const cursor = await databaseConnection.query(`
      FOR doc IN doc_pending_internal
      FILTER doc._key == "${mouApplicationId}"
      FOR s IN doc.fields["$.status.application"].value.succ
      FILTER s.Value.Value == "credit_checking_completed"
      RETURN s.Value.Value
    `);
    const result = await cursor.all();

    if (result.length > 0) {
      return result[0];
    }

    if (attempt === maxRetry) {
      throw new Error(`mouApplicationId "${mouApplicationId}" with status "credit_checking_completed" not found after ${maxRetry} retries`);
    }

    await wait(5000);
  }
}

async function checkerMouActivated({ workflowId }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const cursor = await databaseConnection.query(`
   FOR doc IN doc_pending_internal
    FILTER doc._key == "${workflowId}"
    FOR s IN doc.fields["$.status.application"].value.succ
    RETURN s.Value.Value
    `);
    const result = await cursor.all();

    if (result[3] === 'mou_activated') {
      return result;
    }

    if (attempt === maxRetry) {
      throw new Error(`workflowId "${workflowId}" with MOU Status "mou_activated" not found after ${maxRetry} retries`);
    }

    await wait(5000);
  }
}

export {
  destroyConnection,
  checkerWorkflowIdByMouApplicationId,
  checkerTaskByMouApplicationId,
  checkerPoaStatusByWorkflowId,
  checkerConsentDocumentIdByWorkflowId,
  checkerCreditCheckingCompletedByMouApplicationId,
  checkerRejectStatusByWorkflowId,
  checkerMouActivated
};
