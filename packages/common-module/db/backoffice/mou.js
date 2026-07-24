import { db } from '../../config/index.js';
import { generateRandomNumber, generateUUID } from '../../utils/helpers/random.js';
import { accountMapping } from '../../../web-automation/backoffice-platform/corporate/fixture/account-mapping.js';
import { PRODUCT_MAP } from '../../../web-automation/backoffice-platform/corporate/constants/index.js';
import knex from 'knex';

const dbCredentials = db.backoffice;
const dbConfig = knex(dbCredentials);

function getMarketingIdByAccount({ createdBy }) {
  for (const productAccounts of Object.values(accountMapping)) {
    for (const [branchId, accounts] of Object.entries(productAccounts)) {
      const account = accounts.find(({ username }) => username === createdBy);

      if (account) {
        return {
          branchId,
          marketingId: account.marketingId
        };
      }
    }
  }

  throw new Error(`Marketing ID not found for created_by "${createdBy}"`);
}

function getProductId(productKey) {
  const productIds = {
    [PRODUCT_MAP.HETOSF.KEY]: 5,
    [PRODUCT_MAP.HETONSF.KEY]: 6,
    [PRODUCT_MAP.MACHINERY.KEY]: 12
  };
  const productId = productIds[productKey];

  if (!productId) {
    throw new Error(`Product ID mapping not found for productKey "${productKey}"`);
  }

  return productId;
}

async function getMouIdByAppId(appId) {
  const result = await dbConfig.raw(
    `select id from mou_application where mou_application.mou_application_id = '${appId}';`
  );
  return result.rows[0].id;
}

async function createMouMonitoring({
  mouId,
  olId,
  supplierId = null,
  totalPlafond,
  productKey,
  effectiveRate = 12.5
}) {
  const mouApplication = await dbConfig.raw(
    `select
        ma.debitur_name_enc as debtor_name_enc,
        ma.debitur_name_hash as debtor_name_hash,
        ma.debitur_profile as debtor_profile,
        ma.debitur_phone_number_enc as debtor_phone_number_enc,
        ma.debitur_phone_number_hash as debtor_phone_number_hash,
        ma.reference_id,
        ma.created_by,
        ma.updated_by,
        ma.created_at,
        ma.updated_at,
        olr.party_id
      from mou_application ma
      left join offering_letter_request olr on olr.id = ma.reference_id
      where ma.id = :mouId
      limit 1;`,
    { mouId }
  );

  if (!mouApplication.rows.length) {
    throw new Error(`mou_application id "${mouId}" not found`);
  }

  if (!olId) {
    throw new Error('olId is required to set mou_monitoring.reference_id');
  }

  const application = mouApplication.rows[0];
  const { branchId, marketingId } = getMarketingIdByAccount({ createdBy: application.created_by });

  const id = generateUUID();
  const mouNumber = generateRandomNumber(12, 12);
  const plafond = Number(totalPlafond);
  const productId = getProductId(productKey);

  if (!Number.isFinite(plafond)) {
    throw new Error('totalPlafond must be a valid number');
  }

  const result = await dbConfig.raw(
    `insert into public.mou_monitoring
      (
        id,
        mou_number,
        debtor_name_enc,
        debtor_name_hash,
        debtor_profile,
        debtor_phone_number_enc,
        debtor_phone_number_hash,
        status,
        product_type,
        reference_type,
        reference_id,
        branch_id,
        main_showroom,
        total_plafond,
        remaining_plafond,
        created_by,
        updated_by,
        created_at,
        updated_at,
        deleted_at,
        branch_name,
        activated_at,
        start_date,
        end_date,
        effective_rate,
        marketing_id,
        party_id,
        reserved_plafond,
        product_id,
        supplier
      )
      values
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        'ACTIVE',
        'GENERAL',
        'OFFERING_LETTER',
        ?,
        ?,
        '',
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        null,
        ?,
        current_date,
        current_date,
        current_date + interval '1 year',
        ?,
        ?,
        ?,
        0.00,
        ?,
        ?
      )
      returning id, mou_number;`,
    [
      id,
      mouNumber,
      application.debtor_name_enc,
      application.debtor_name_hash,
      application.debtor_profile,
      application.debtor_phone_number_enc,
      application.debtor_phone_number_hash,
      olId,
      branchId,
      plafond,
      plafond,
      application.created_by,
      application.updated_by,
      application.created_at,
      application.updated_at,
      'MEDAN',
      effectiveRate,
      marketingId,
      application.party_id,
      productId,
      supplierId
    ]
  );

  return {
    mouMonitoringId: result.rows[0].id,
    mouNumber: result.rows[0].mou_number,
    result: result.rows[0]
  };
}

export { createMouMonitoring, getMouIdByAppId };
