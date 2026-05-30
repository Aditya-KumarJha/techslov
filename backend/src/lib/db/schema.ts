import type { Pool } from 'pg';

import { env } from '../../config/env.js';

export async function ensureDatabaseSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
      video_id text PRIMARY KEY,
      source_url text NOT NULL,
      creator text NOT NULL,
      follower_count integer NOT NULL DEFAULT 0,
      views integer NOT NULL DEFAULT 0,
      likes integer NOT NULL DEFAULT 0,
      comments integer NOT NULL DEFAULT 0,
      hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
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

  const useQdrant = Boolean(env.QDRANT_URL);

  if (!useQdrant) {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

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
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_turns (
      id bigserial PRIMARY KEY,
      conversation_id text NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      timestamp timestamptz NOT NULL
    )
  `);
}
