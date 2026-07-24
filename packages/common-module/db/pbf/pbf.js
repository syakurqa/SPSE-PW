import { db } from '../../config/index.js';
import knex from 'knex';

const dbCredentials = db.pbf_backend;
const dbConfig = knex(dbCredentials);

async function checkOrInitConnection() {
  try {
    const result = await dbConfig.raw('SELECT * FROM account limit 1;');
    return result;
  } catch (err) {
    dbConfig.initialize();
  }
  return null;
}

function destroyConnection() {
  dbConfig.destroy();
  return null;
}

async function rawQuery(query) {
  const result = await dbConfig.raw(query);
  return result.rows;
}

export {
  checkOrInitConnection,
  destroyConnection,
  rawQuery
};
