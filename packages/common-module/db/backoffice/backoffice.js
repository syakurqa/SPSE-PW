import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.backoffice;
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

async function getDisbursementApplicationById(disbursementApplicationId) {
  const result = await dbConfig.raw(
    `SELECT disbursement_application_id FROM disbursement_application_survey WHERE disbursement_application_id = '${disbursementApplicationId}' LIMIT 1;`
  );
  return result.rows;
}

async function getActiveMouMonitoringId() {
  const result = await dbConfig.raw(
    'SELECT id FROM public.mou_monitoring WHERE status = \'ACTIVE\' ORDER BY created_at DESC LIMIT 1;'
  );
  if (!result.rows.length) {
    throw new Error('No active mou_monitoring record found in the database');
  }
  return result.rows[0].id;
}

async function getActiveMoUforDisbursement() {
  const result = await dbConfig.raw(`
    SELECT id
    FROM mou_monitoring
    WHERE status = 'ACTIVE'
      AND activated_at IS NOT NULL
      AND (total_plafond - reserved_plafond) > 200000000
      AND product_id = '13'  
    ORDER BY ABS(EXTRACT(EPOCH FROM (activated_at - NOW())))
    LIMIT 1;
  `);
  return result.rows;
}

async function updateEligibleProducts(mouMonitoringId) {
  const { rows } = await dbConfig.raw(
    `
      UPDATE mou_monitoring
      SET eligible_products = ARRAY['SSF_EZSTOK', 'SSF_STOCK_FIN', 'SSF_FF']
      WHERE id = '${mouMonitoringId}';
    `
  );

  return rows;
}
async function updateDisbursementSurveyStatusToInProgress(disbursementApplicationId) {
  const result = await dbConfig.raw(
    `UPDATE disbursement_application_survey SET status = 'IN_PROGRESS' WHERE disbursement_application_id = '${disbursementApplicationId}';`
  );
  return result;
}

async function getEngineNumber(engineNumber) {
  const result = await dbConfig.raw(
    `SELECT engine_number FROM collateral WHERE engine_number = '${engineNumber}' LIMIT 1;`
  );
  return result.rows;
}

async function getChassisNumber(chassisNumber) {
  const result = await dbConfig.raw(
    `SELECT chassis_number FROM collateral WHERE chassis_number = '${chassisNumber}' LIMIT 1;`
  );
  return result.rows;
}

export {
  checkOrInitConnection,
  destroyConnection,
  getDisbursementApplicationById,
  getActiveMouMonitoringId,
  getActiveMoUforDisbursement,
  updateDisbursementSurveyStatusToInProgress,
  getEngineNumber,
  getChassisNumber,
  updateEligibleProducts
};
