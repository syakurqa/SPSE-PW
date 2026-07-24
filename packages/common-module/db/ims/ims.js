import { wait } from '../../utils/helpers/wait.js';
import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.ims;
const dbConfig = knex(dbCredentials);
const IMS_PRODUCT_ID = Object.freeze({
  CAR: '1',
  MCY: '2',
  PBF: '3'
});
const DEFAULT_IMS_PRODUCT_ID = IMS_PRODUCT_ID.CAR;

function getIMSProductId(product) {
  return IMS_PRODUCT_ID[product] || product || DEFAULT_IMS_PRODUCT_ID;
}

async function checkOrInitConnection() {
  try {
    const result = await dbConfig.raw('select * from agreement_inventory limit 1');
    return result;
  } catch (err) {
    dbConfig.initialize();
  }
  return null;
}

async function destroyConnection() {
  await dbConfig.destroy();
  return null;
}

async function getEligibleSellingPriceByProduct(product) {
  const productId = getIMSProductId(product);
  const result = await dbConfig.raw(`
    SELECT
      sp.agreement_number
    FROM selling_price sp
    LEFT JOIN agreement_inventory a
      ON a.id = sp.agreement_inventory_id
    LEFT JOIN agreement_inventory_collateral ac
      ON a.id = ac.agreement_inventory_id
    WHERE sp.status IN ('NEW', 'REJECTED')
      AND a.asset_status = 'INV'
      AND a.contract_status = 'INV'
      AND a.channel = 'BRAVO'
      AND a.product_id = ?
  `, [productId]);

  if (!result.rows.length) {
    throw new Error(`No eligible selling price for product_id=${productId}`);
  }

  return result.rows;
}

async function getEligibleAssetReceived() {
  return getEligibleAssetReceivedByProduct();
}

async function getEligibleAssetReceivedByProduct(product) {
  const productId = product ? getIMSProductId(product) : null;
  const productFilter = productId ? 'AND a.product_id = ?' : '';
  const bindings = productId ? [productId] : [];

  const result = await dbConfig.raw(`
    SELECT a.agreement_number,
       a.id as agreement_inventory_id,
       ac.asset_commercial_description as asset_description,
       ar.status,
       ac.vehicle_plate_number as license_number,
       ar.id as asset_received_id,
       a.status as agreement_status,
       a.repossess_date as repossess_date
  FROM asset_checklist ar
  INNER JOIN agreement_inventory a ON a.id = ar.agreement_inventory_id
  LEFT JOIN agreement_inventory_collateral ac ON a.id = ac.agreement_inventory_id
  LEFT JOIN selling_price sp ON a.id = sp.agreement_inventory_id
  WHERE ar.status IN ('NEW')
  AND (ar.deleted IS NULL OR ar.deleted = FALSE)
  AND (a.deleted IS NULL OR a.deleted = FALSE)
  AND ((a.contract_status = 'LIV' AND a.asset_status IN ('REP'))
      OR (a.contract_status = 'INV' AND a.asset_status IN ('INV'))
      OR (a.contract_status = 'ICP' AND a.asset_status IN ('REP')))
  AND sp.status <> 'APPROVED'
  ${productFilter}
  `, bindings);

  return result.rows;
}

async function getEligibleAssetRelocation(product = DEFAULT_IMS_PRODUCT_ID) {
  const productFilter = 'AND a.product_id = ?';
  const bindings = [getIMSProductId(product)];

  const result = await dbConfig.raw(`
    SELECT a.agreement_number,
       ac.asset_commercial_description as asset_description,
       a.status,
       ac.vehicle_plate_number as license_number,
       ar.id as asset_received_id
  FROM asset_checklist ar
  LEFT JOIN agreement_inventory a ON a.id = ar.agreement_inventory_id
  LEFT JOIN agreement_inventory_collateral ac ON a.id = ac.agreement_inventory_id
  LEFT JOIN selling_price sp ON a.id = sp.agreement_inventory_id
  WHERE ar.id IN (
    SELECT ar_sub.id
    FROM asset_checklist ar_sub
    WHERE ar_sub.created_at = (
      SELECT MAX(ar_inner.created_at)
      FROM asset_checklist ar_inner
      WHERE ar_inner.agreement_inventory_id = ar_sub.agreement_inventory_id
    )
)
AND a.status IN ('SUBMITTED')
AND ((a.contract_status = 'LIV' AND a.asset_status IN ('REP'))
     OR (a.contract_status = 'INV' AND a.asset_status IN ('INV'))
     OR (a.contract_status = 'ICP' AND a.asset_status IN ('REP')))
AND sp.status <> 'APPROVED'
${productFilter}
  `, bindings);

  return result.rows;
}

async function insertEventSchedule({
  eventID, agreementInventoryID, eventDate
}) {
  const result = await dbConfig.raw(`INSERT INTO event_schedule(
    event_schedule_id,
    agreement_inventory,
    event_date,
    created_at,
    created_by,
    updated_at, 
    deleted_at, 
    deleted_by, 
    deleted, 
    event_result, 
    reason_event,
    payload_external_data, 
    inventory_price_id, 
    sales_report_id)
    VALUES (
    '${eventID}',
    '${agreementInventoryID}',
    '${eventDate}',
    NOW(),
    '098842',
    NOW(),
    null,
    null, 
    false, 
    'SOLD', 
    'Sold at auction Automation',
    '{}', 
    null, 
    null);
    `);

  return result;
}

async function updateContractStatusByAgreementID({ agreementNo, newStatus = 'INV' }) {
  await wait(5000);
  const result = await dbConfig.raw(`UPDATE agreement_inventory
     SET contract_status = '${newStatus}'
      WHERE agreement_number = '${agreementNo}';`);

  return result;
}

async function getAgreementInventoryID(agreementNo) {
  const result = await dbConfig.raw(`select id 
    from agreement_inventory 
    WHERE agreement_number = '${agreementNo}'`);

  return result.rows;
}

export {
  IMS_PRODUCT_ID,
  getIMSProductId,
  getEligibleSellingPriceByProduct,
  getEligibleAssetReceived,
  getEligibleAssetReceivedByProduct,
  getEligibleAssetRelocation,
  destroyConnection,
  insertEventSchedule,
  getAgreementInventoryID,
  updateContractStatusByAgreementID,
  checkOrInitConnection
};
