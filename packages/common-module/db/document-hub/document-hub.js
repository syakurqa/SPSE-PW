import pkg from 'pg';
import { db } from '@common/config/index.js';

const { Pool } = pkg;

const createPool = () => {
  return new Pool({
    ...db['document-hub'].connection,
    connectionTimeoutMillis: db['document-hub'].acquireConnectionTimeout,
  });
};

export const getDraftsForFinalize = async () => {
  const pool = createPool();

  try {
    const res = await pool.query(`
      SELECT document_hub_uuid, doc_status
      FROM public.doc_drafts
      WHERE doc_status IN (
        'UNSIGNED_DRAFT_ACTIVE',
        'CREATE_DRAFT_ERROR',
        'EXPIRE',
        'DIGITAL_SIGN_INITIATE_FAILED',
        'FINAL_WITHOUT_DIGITAL_SIGNATURE',
        'CANCEL',
        'DIGITAL_SIGN_ONGOING_PROCESS',
        'CREATE_DRAFT_PENDING'
      )
      AND deleted = false
      AND is_latest_version = true
      ORDER BY created_at DESC
    `);

    return res.rows;

  } finally {
    await pool.end();
  }
};
