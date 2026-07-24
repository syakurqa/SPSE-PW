import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.bravo_payment;
const dbConfig = knex(dbCredentials);
const dbCredentialsConfins = db.confins;
const dbConfigConfin = knex(dbCredentialsConfins);
const dateNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

async function checkOrInitConnection() {
  try {
    await dbConfig.raw('select * from payment limit 1');
  } catch (err) {
    dbConfig.initialize();
  }
  return null;
}

function destroyConnection() {
  dbConfig.destroy();
  return null;
}

async function updateTDPWopToBank(agreementNo) {
  const result =
    await dbConfig.raw(`update down_payment set way_of_payment = 'BANK' where agreement_number = '${agreementNo}'`);
  return result.rows;
}

async function checkCashier(nik, branchId) {
  const result =
    await dbConfig.raw(`select * from cashier where nik = '${nik}' and branch_id = '${branchId}'`);
  if (result.rowCount == 0) {
    return 'DATA_NOT_FOUND';
  }
  return result.rows;
}

async function checkOpenCloseCashier(nik, branchId) {
  const result =
    await dbConfig.raw(`select * from open_close_cashier where nik = '${nik}' and branch_id = '${branchId}' and Date(opening_date) = '${dateNow}'`);
  if (result.rowCount == 0) {
    return 'DATA_NOT_FOUND';
  }
  return result.rows;
}

async function checkCashierHistoryConfins(loginId, branchId) {
  const result =
    await dbConfigConfin.raw(`select top 2 * from bfidb.dbo.CashierHistory ch WHERE LoginId like '${loginId}' and BranchID = '${branchId}' and openingdate = '${dateNow}' order by DtmUpd desc`);
  if (result.length === 0) {
    return 'DATA_NOT_FOUND';
  }
  return result;
}

async function checkBranchEmployeeConfins(nik, branchId) {
  const result =
    await dbConfigConfin.raw(`select * from bfidb.dbo.BranchEmployee WHERE NIK = '${nik}' and BranchID = ${branchId} order by EmployeeID desc`);
  return checkCashierHistoryConfins(result[0].EmployeeID.trim(), branchId);
}

async function forceCloseCashierOpen(nik, branchId) {
  forceCloseCashierOpenConfins(nik, branchId);
  forceCloseCashierOpenBravo(nik, branchId);
}

async function forceCloseCashierOpenConfins(nik, branchId) {
  const getEmpId =
    await dbConfigConfin.raw(`select * from bfidb.dbo.BranchEmployee WHERE NIK = '${nik}' and BranchID = ${branchId} and IsActive = 1 order by EmployeeID desc`);
  const deleteCashierHistory =
    await dbConfigConfin.raw(`delete bfidb.dbo.CashierHistory WHERE LoginId like '${getEmpId[0].EmployeeID.trim()}' and BranchID = ${branchId} and openingdate >= '${dateNow}'`);
  return deleteCashierHistory;
}

async function forceCloseCashierOpenBravo(nik, branchId) {
  await dbConfig.raw(`delete from open_close_cashier where nik = '${nik}' and branch_id = '${branchId}' and opening_date::date = '${dateNow}'`);
  await dbConfig.raw(`delete from open_close_cashier where nik = '${nik}' and branch_id = '${branchId}' and cashier_status<>'CLOSED'`);
}

async function getNextApproverNik(agreementNo) {
  const getRefundId =
    await dbConfig.raw(`select refund_id from refund where agreement_number = '${agreementNo}' order by created_at desc limit 1`);
  const getNikApprover =
    await dbConfig.raw(`select * from approval where reference_id = '${getRefundId.rows[0].refund_id.trim()}' order by created_at desc`);
  return getNikApprover.rows[0].action_by.trim().split(';')[0];
}

async function getApprovalStatus(agreementNo) {
  const getRefundId =
    await dbConfig.raw(`select refund_id from refund where agreement_number = '${agreementNo}' order by created_at desc limit 1`);
  const getApprover =
    await dbConfig.raw(`select * from approval where reference_id = '${getRefundId.rows[0].refund_id.trim()}' order by created_at desc`);
  return getApprover.rows[0].action.trim();
}

async function getConfinsTrxNumberRefund(agreementNo) {
  const getRefundId =
    await dbConfig.raw(`select confins_transaction_number from refund where agreement_number = '${agreementNo}' order by created_at desc limit 1`);
  return getRefundId.rows[0].confins_transaction_number.trim();
}

export {
  checkOrInitConnection,
  destroyConnection,
  updateTDPWopToBank,
  checkCashier,
  checkCashierHistoryConfins,
  checkOpenCloseCashier,
  checkBranchEmployeeConfins,
  forceCloseCashierOpen,
  forceCloseCashierOpenConfins,
  forceCloseCashierOpenBravo,
  getNextApproverNik,
  getApprovalStatus,
  getConfinsTrxNumberRefund
};
