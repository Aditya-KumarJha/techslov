import type { Pool } from 'pg';

import { env } from '../../config/env.js';

export async function canUsePgvector(pool: Pool) {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '0A000') {
      return false;
    }

    throw error;
  }
}

export async function ensureDatabaseSchema(pool: Pool, options?: { pgvectorAvailable?: boolean }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
      video_id text PRIMARY KEY,
      source_url text NOT NULL,
      title text NOT NULL DEFAULT '',
      creator text NOT NULL,
      follower_count integer NOT NULL DEFAULT 0,
      views integer NOT NULL DEFAULT 0,
      likes integer NOT NULL DEFAULT 0,
      comments integer NOT NULL DEFAULT 0,
      hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
      description text NOT NULL DEFAULT '',
      upload_date text NOT NULL DEFAULT '',
      duration_seconds integer NOT NULL DEFAULT 0,
      engagement_rate double precision NOT NULL DEFAULT 0,
      transcript_preview text NOT NULL DEFAULT '',
      transcript text NOT NULL DEFAULT '',
      transcript_chunk_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''`);

  const useQdrant = env.VECTOR_STORE === 'qdrant' && Boolean(env.QDRANT_URL);
  const usePgvector = !useQdrant && options?.pgvectorAvailable !== false;

  if (usePgvector) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${env.PGVECTOR_TABLE} (
        chunk_id text PRIMARY KEY,
        video_id text NOT NULL,
        source_url text NOT NULL,
        text text NOT NULL,
        start_time_seconds integer NOT NULL,
        end_time_seconds integer NOT NULL,
        embedding vector(768) NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingest_jobs (
      job_id text PRIMARY KEY,
      status text NOT NULL,
      created_at timestamptz NOT NULL,
      completed_at timestamptz NOT NULL,
      chunk_count integer NOT NULL DEFAULT 0,
      videos jsonb NOT NULL DEFAULT '[]'::jsonb
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id text PRIMARY KEY,
      title text NOT NULL DEFAULT '',
      contexts jsonb NOT NULL DEFAULT '[]'::jsonb,
      active_context_index integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contexts jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS active_context_index integer NOT NULL DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_turns (
      id bigserial PRIMARY KEY,
      conversation_id text NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      timestamp timestamptz NOT NULL,
      citations jsonb NOT NULL DEFAULT '[]'::jsonb,
      transcript_evidence jsonb NOT NULL DEFAULT '[]'::jsonb
    )
  `);

  await pool.query(`ALTER TABLE conversation_turns ADD COLUMN IF NOT EXISTS citations jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE conversation_turns ADD COLUMN IF NOT EXISTS transcript_evidence jsonb NOT NULL DEFAULT '[]'::jsonb`);
}
