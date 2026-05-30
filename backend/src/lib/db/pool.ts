import { Pool } from 'pg';

import { env } from '../../config/env.js';

let pool: Pool | undefined;

export function getDatabasePool() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for database persistence');
  }

  pool ??= new Pool({
    connectionString: env.DATABASE_URL
  });

  return pool;
}
