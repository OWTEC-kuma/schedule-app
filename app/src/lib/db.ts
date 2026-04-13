import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Set process.env.DATABASE_URL to your PostgreSQL connection string.'
  );
}

declare global {
  // eslint-disable-next-line no-var
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
