import { wait } from '@common/utils/helpers/wait.js';
import { Database } from 'arangojs';
import { db } from '@common/config/index.js';

const databaseConnection = new Database({
  url: db.mou_heto_machinery.url,
  databaseName: db.mou_heto_machinery.databaseName,
  auth: {
    username: db.mou_heto_machinery.auth.username,
    password: db.mou_heto_machinery.auth.password,
  },
});

function destroyConnection() {
  databaseConnection.destroy();
  return null;
}

async function checkerCifIdByWorkflowId({ workflowId }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    await wait(5000);
    const query = `
      FOR doc IN doc_pending_internal
      FILTER doc._key == @workflowId
      FOR s IN doc.fields["$.customer.cif_id"].value.succ
      RETURN s.Value.Value
    `;
    const cursor = await databaseConnection.query(query, { workflowId });
    const result = await cursor.all();

    if (result.length > 0 && result[0]) {
      return result[0];
    }

    if (attempt === maxRetry) {
      throw new Error(`workflowId "${workflowId}" CIF ID not found after ${maxRetry} retries`);
    }
  }

  throw new Error(`workflowId "${workflowId}" CIF ID not found after ${maxRetry} retries`);
}

async function checkerApplicantStatusByWorkflowId({ workflowId, expectedStatus }) {
  const maxRetry = 5;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    await wait(5000);
    const query = `
      FOR doc IN doc_pending_internal
        FILTER doc._key == @workflowId
        FOR s IN doc.fields["$.process.underwriting_task.applicant_status"].value.succ
          RETURN s.Value.Value
    `;
    const cursor = await databaseConnection.query(query, { workflowId });
    const result = await cursor.all();

    if (result.includes(expectedStatus)) {
      return expectedStatus;
    }

    if (attempt === maxRetry) {
      throw new Error(`workflowId "${workflowId}" applicant status "${expectedStatus}" not found after ${maxRetry} retries. Got: [${result.join(', ') || 'empty'}]`);
    }
  }

  throw new Error(`workflowId "${workflowId}" applicant status "${expectedStatus}" not found after ${maxRetry} retries`);
}

export {
  destroyConnection,
  checkerCifIdByWorkflowId,
  checkerApplicantStatusByWorkflowId,
};
