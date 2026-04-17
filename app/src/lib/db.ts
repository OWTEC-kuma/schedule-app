import { Pool } from 'pg';

const connectionString = (process.env.SAVED_DATA_DATABASE_URL ?? process.env.DATABASE_URL)?.trim();

if (!connectionString) {
  throw new Error(
    'SAVED_DATA_DATABASE_URL or DATABASE_URL is not set. Set one of these environment variables to your PostgreSQL connection string.'
  );
}

declare global {
  var __owtecPool: Pool | undefined;
}

export const pool =
  global.__owtecPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__owtecPool = pool;
}
