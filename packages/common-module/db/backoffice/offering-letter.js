import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.backoffice;
const dbConfig = knex(dbCredentials);

async function byPassConsent(offeringLetterRequestId, status = 'APPROVED') {
  const getOlId = await dbConfig.raw(
    `select offering_letter_ids from offering_letter_request olr where olr.offering_letter_request_id = '${offeringLetterRequestId}';`
  );
  const olRequestId = getOlId.rows[0].offering_letter_ids[0];

  await dbConfig.raw(
    `update offering_letter_request
      set status = '${status}'
      where offering_letter_request_id = '${offeringLetterRequestId}';`
  );

  await dbConfig.raw(
    `update offering_letter ol
      set status = '${status}'
      where id = '${olRequestId}';`
  );
}

export { byPassConsent };
