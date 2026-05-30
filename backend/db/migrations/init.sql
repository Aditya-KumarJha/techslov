-- Initial database schema for social-rag backend.
-- Qdrant is the active vector store when QDRANT_URL is configured, so this file only creates the shared app tables.

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
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  job_id text PRIMARY KEY,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  chunk_count integer NOT NULL DEFAULT 0,
  videos jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  contexts jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_context_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_turns (
  id bigserial PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  timestamp timestamptz NOT NULL
);

-- Vector store table (pgvector)
-- If you choose pgvector instead of Qdrant, create the vector table via the app bootstrap or a pgvector-specific migration.
