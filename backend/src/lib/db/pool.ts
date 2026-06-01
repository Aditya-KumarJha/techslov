import { Pool } from 'pg';

import { env } from '../../config/env.js';

let pool: Pool | undefined;

export function getDatabasePool() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for database persistence');
  }

  // In some hosting environments the libpq SSL-mode behavior changes.
  // To maintain compatibility with existing deployments, when running in
  // production and the connection string doesn't explicitly define an
  // SSL mode, enable a permissive SSL config so connections still succeed.
  const connectionString = env.DATABASE_URL;

  const hasSslMode = /sslmode=/.test(connectionString);

  if (process.env.NODE_ENV === 'production' && !hasSslMode) {
    pool ??= new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  } else {
    pool ??= new Pool({
      connectionString
    });
  }

  return pool;
}
