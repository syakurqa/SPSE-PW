import { wait } from '../../utils/helpers/wait.js';
import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.bpm;
const dbConfig = knex(dbCredentials);

async function checkOrInitConnection() {
  try {
    await dbConfig.raw('select * from loan_onboarding_applications limit 1');
  } catch (err) {
    dbConfig.initialize();
  }
  return null;
}

function destroyConnection() {
  dbConfig.destroy();
  return null;
}

/**
 * Get assignment data for a product, filtered by asset type (multi / single).
 *
 * Asset type is derived from how many applications share the same lead_group_id:
 * - multi-asset  : the lead_group has more than one application (count > 1)
 * - single-asset : the lead_group has exactly one application  (count = 1)
 *
 * The lead_group_id rule is product-specific:
 *
 * | productId | assetType    | lead_group_id | application count |
 * | --------- | ------------ | ------------- | ----------------- |
 * | 1 (NDF4W) | multi-asset  | not null      | > 1               |
 * | 1 (NDF4W) | single-asset | not null      | = 1               |
 * | 2 (NDF2W) | multi-asset  | not null      | > 1               |
 * | 2 (NDF2W) | single-asset | null          | standalone        |
 * | 4 (DF4W)  | single-asset | not null      | = 1               |
 * | 11 (DF2W) | single-asset | not null      | = 1               |
 *
 * @param {Object} params
 * @param {string|number} params.productId - Product ID (1 NDF4W, 2 NDF2W, 4 DF4W, ...).
 * - 1 : NDF 4W
 * - 2 : NDF 2W
 * - 4 : DF 4W
 * - 11 : DF 2W
 * @param {'multi-asset'|'single-asset'} [params.assetType='single-asset'] - Asset type to match.
 * @param {string} [params.status='OPEN'] - The assignment_status to filter.
 * - CANCEL_REASSIGN_REQUEST
 * - CANCELLED_BY_SYSTEM
 * - CANCELLED_BY_USER
 * - COMPLETE
 * - CONFIRMED
 * - DONE
 * - FOLLOW_UP_FAIL
 * - FOLLOW_UP_OPEN
 * - OPEN
 * - PHYSICAL_DOCUMENT_SUBMITTED
 * - PROCESS_AKAD
 * - REJECTED
 * - REPROCESS
 * - REQUEST_CANCEL
 * - REQUEST_REASSIGN
 * - REQUEST_REPROCESS
 * - REQUEST_TAKE
 * - UNCONFIRMED
 * - UW_RETURNED
 * - WIP
 * @param {number} [params.limit=10] - Maximum number of rows to return.
 * @returns {Promise<Array>} assignment rows (id = assignment id, application_id, lead_group_id, ...).
 * @throws {Error} if productId is missing, assetType is invalid, or multi-asset is requested
 *                 for DF4W (4) / DF2W (11) which do not support multi-asset yet.
 */
async function getAssignmentDataByAssetType({
  productId,
  assetType = 'single-asset',
  status = 'OPEN',
  limit = 10,
}) {
  if (!productId) throw new Error('productId is required');
  if (assetType !== 'multi-asset' && assetType !== 'single-asset') {
    throw new Error(`Invalid assetType: ${assetType}. Use 'multi-asset' or 'single-asset'.`);
  }

  const isMulti = assetType === 'multi-asset';
  // DF 4W (productId 4) and DF 2W (productId 11) do not support multi-asset yet.
  if (isMulti && (String(productId) === '4' || String(productId) === '11')) {
    throw new Error(`multi-asset is not supported for productId ${productId} (DF4W / DF2W) yet.`);
  }
  // Single-asset NDF 2W (productId 2) is not grouped, so its lead_group_id is null.
  // Every other supported case is grouped (lead_group_id is not null).
  const leadGroupIsNull = !isMulti && String(productId) === '2';
  const leadGroupCondition = leadGroupIsNull ? 'a.lead_group_id is null' : 'a.lead_group_id is not null';

  // The count filter only applies when lead_group_id is populated (nulls cannot be grouped):
  // multi-asset => more than one application per group; single-asset => exactly one.
  const countFilter = leadGroupIsNull
    ? ''
    : `and a.lead_group_id in (
        select lead_group_id from application
        where lead_group_id is not null
        group by lead_group_id
        having count(*) ${isMulti ? '> 1' : '= 1'}
      )`;

  const result = await dbConfig.raw(
    `select sa.id, a.id as application_id, a.lead_group_id, sa.lead_id, sa.assignment_status, sa.surveyor_id, sa.assignment_type, sa.survey_type, sa.appointment_date
      from surveyor_assignment sa
      join application a on a.id = sa.application_id
      where sa.product_id::text = ? and sa.assignment_status::text = ? and ${leadGroupCondition} ${countFilter}
      order by sa.id desc
      limit ?;`,
    [String(productId), status, limit]
  );
  return result.rows;
}

async function getApplicationDataByLeadId(leadId) {
  const result =
    await dbConfig.raw(`select b.id as assignment_id, b.lead_id, b.appointment_date, b.hidden, a.process_id, a.lead_group_id , a.status ,a.risk_type, a.name, l.lead_source, a.schedule_selection_status
      from application as a
      join "lead" l on a.lead_id = l.id
      left outer join surveyor_assignment as b on a.id = b.application_id
      left outer join surveyor_assignment_asset_validation saav on b.id = saav.assignment_id 
      where l.lead_id = '${leadId}' order by b.id desc;`);
  return result.rows;
}

async function getApplicationDataByAssignmentId(assignmentId) {
  const result =
    await dbConfig.raw(`select b.id as assignment_id, b.application_id, c.full_name as customer_name,c.identity_number, b.lead_id, b.appointment_date, a.process_id, a.lead_group_id , a.status ,a.risk_type, a.name, l.lead_source
      from application as a
      join "lead" l on a.lead_id = l.id
      left outer join surveyor_assignment as b on a.id = b.application_id
      left outer join surveyor_assignment_asset_validation saav on b.id = saav.assignment_id 
      join customer c on a.customer_id  = c.id
      where b.id = '${assignmentId}' order by b.id desc;`);
  return result.rows;
}

async function checkerStatusCreationLOS(leadId, status = 'SURVEY_ASSIGNED', counter = 0) {
  if (counter > 10) {
    throw new Error(`${leadId} with application.status: ${status} is not found!`);
  }
  const nextCounter = counter + 1;
  const data = await getApplicationDataByLeadId(leadId);
  if (data.length == 0) {
    await wait(5000);
    return checkerStatusCreationLOS(leadId, status, nextCounter);
  } else if (data[0].status != status) {
    await wait(5000);
    return checkerStatusCreationLOS(leadId, status, nextCounter);
  } else if (data[0].assignment_id === null) {
    await wait(5000);
    return checkerStatusCreationLOS(leadId, status, nextCounter);
  }
  return data;
}

async function checkerStatusScheduleSelection(leadId, scheduleStatus = 'WAITING_CUSTOMER_SET', counter = 0) {
  if (counter > 20) {
    throw new Error(`${leadId} did not reach application.schedule_selection_status=${scheduleStatus} after ${counter} retries.`);
  }
  const nextCounter = counter + 1;
  const data = await getApplicationDataByLeadId(leadId);

  if (data.length == 0) {
    await wait(5000);
    return checkerStatusScheduleSelection(leadId, scheduleStatus, nextCounter);
  } else if (data[0].schedule_selection_status === scheduleStatus && data[0].status === 'ACCEPTED') {
    return data;
  } else if (data[0].schedule_selection_status === 'NONE' && data[0].status === 'SURVEY_ASSIGNED') {
    return data;
  } else if (data[0].schedule_selection_status === scheduleStatus && data[0].status === 'SURVEY_ASSIGNED') {
    return data;
  }

  await wait(3000);
  return checkerStatusScheduleSelection(leadId, scheduleStatus, nextCounter);
}

async function checkerDocumentAgreementCreation(applicationId, counter = 0) {
  if (counter > 10) {
    throw new Error(`document with ${applicationId} still not found!`);
  }
  const nextCounter = counter + 1;
  const data = await dbConfig.raw(`select * from document_agreement_contract where document_agreement_contract.application_id = '${applicationId}';`);
  if (data.rows.length == 0) {
    await wait(5000);
    return checkerDocumentAgreementCreation(applicationId, nextCounter);
  }

  return data;
}

async function updateSurveyorAppointmentDatebyLeadId({ date, leadId }) {
  const result = await dbConfig.raw(
    'UPDATE surveyor_assignment set appointment_date = ? where lead_id = ?',
    [
      date,
      leadId
    ]
  );
  return result;
}

async function updateSurveyorAssignmentSurveyorIdByLeadId({
  surveyorId,
  leadId,
}) {
  const result = await dbConfig.raw(
    `UPDATE surveyor_assignment sa
      SET surveyor_id = ?
      WHERE sa.lead_id = ?`,
    [
      surveyorId,
      leadId
    ]
  );
  return result;
}
export {
  checkOrInitConnection,
  destroyConnection,
  getAssignmentDataByAssetType,
  getApplicationDataByLeadId,
  checkerStatusCreationLOS,
  checkerStatusScheduleSelection,
  updateSurveyorAppointmentDatebyLeadId,
  updateSurveyorAssignmentSurveyorIdByLeadId,
  getApplicationDataByAssignmentId,
  checkerDocumentAgreementCreation
};
