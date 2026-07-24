import { wait } from '@common/utils/helpers/wait.js';
import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.partnership;
const dbConfig = knex(dbCredentials);

async function checkOrInitConnection() {
  try {
    const result = await dbConfig.raw(
      'select * from loan_onboarding_applications limit 1'
    );
    return result;
  } catch (err) {
    dbConfig.initialize();
  }
  return null;
}

function destroyConnection() {
  dbConfig.destroy();
  return null;
}

async function getLoanApplicationIdBySubmissionId(submissionId) {
  const result = await dbConfig.raw(
    'SELECT x.loan_application_id  FROM public.loan_onboarding_applications x WHERE loan_onboarding_submission_id = ?',
    [
      submissionId
    ]
  );

  return result.rows;
}

async function checkerLeadIdCreationPartnership(submissionId, counter = 0) {
  if (counter > 5) {
    throw new Error('Ga ketemu');
  }
  const nextCounter = counter + 1;

  const data = await getLoanApplicationIdBySubmissionId(submissionId);
  if (data.length == 0) {
    await wait(5000);
    return checkerLeadIdCreationPartnership(submissionId, nextCounter);
  }

  return data;
}

export {
  checkOrInitConnection,
  destroyConnection,
  checkerLeadIdCreationPartnership,
  getLoanApplicationIdBySubmissionId,
};
