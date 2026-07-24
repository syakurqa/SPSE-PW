import { db } from '../../config/index.js';
import knex from 'knex';

const dbConfig = knex(db.bpm);

async function getTotalExposureApplication(underwritingId) {
  const result = await dbConfig.raw(`
    SELECT
      ucd.underwriting_id,
      COALESCE(SUM(nc.capitalized_ntf_amount), 0) AS total_exposure_application
    FROM underwriting_collateral_detail ucd
    LEFT JOIN surveyor_assignment_collateral_information saci
      ON saci.id = ucd.surveyor_assignment_collateral_information_id
    LEFT JOIN surveyor_assignment sa
      ON sa.id = saci.assignment_id
    LEFT JOIN application a
      ON a.id = sa.application_id
    LEFT JOIN calculation nc
      ON nc.id = a.new_calculation_id
    WHERE ucd.underwriting_id = ?
      AND a.deleted = false
    GROUP BY ucd.underwriting_id
  `, [underwritingId]);

  return result.rows[0]?.total_exposure_application ?? 0;
}

function destroyConnection() {
  dbConfig.destroy();
}

export { getTotalExposureApplication, destroyConnection };
