const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Owtec-4340@localhost:5432/schedule_db',
});

pool.query('SELECT 1').then((r) => {
  console.log('OK', r.rows);
  return pool.end();
}).catch((e) => {
  console.error(e);
  return pool.end().then(() => process.exit(1));
});
