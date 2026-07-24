import pkg from 'pg';
import { db } from '@common/config/index.js';

const { Pool } = pkg;

// create once
const pool = new Pool({ ...db['kyc_sign'].connection, });

// ambil process_id berdasarkan reference_id + sign_type
export const getProcessIdByReferenceAndSignType = async (
  referenceId,
  signType
) => {

  const res = await pool.query(
    `
      SELECT process_id
      FROM sign_process
      WHERE reference_id = $1
      AND sign_type = $2
      LIMIT 1
    `,
    [referenceId, signType]
  );

  return res.rows[0]?.process_id;
};
