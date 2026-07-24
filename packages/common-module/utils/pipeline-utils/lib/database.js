import knex from 'knex';
import { db } from '../../../config/index.js';

let dbInstance = null;

export function getConnection() {
  if (!dbInstance) {
    const config = db['qa-reporting'];
    dbInstance = knex(config);
  }
  return dbInstance;
}

export function destroyConnection() {
  if (dbInstance) {
    dbInstance.destroy();
    dbInstance = null;
  }
}
