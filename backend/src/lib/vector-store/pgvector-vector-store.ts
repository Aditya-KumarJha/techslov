import { Pool } from 'pg';

import { env } from '../../config/env.js';
import type { TranscriptChunk } from '../transcript/transcript-fetcher.js';
import type { EmbeddedTranscriptChunk } from './memory-vector-store.js';

export class PgvectorVectorStore {
  private readonly pool: Pool;

  constructor() {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for the pgvector vector store');
    }

    this.pool = new Pool({ connectionString: env.DATABASE_URL });
  }

  async upsertChunks(chunks: EmbeddedTranscriptChunk[]): Promise<void> {
    if (!chunks.length) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(`
        CREATE TABLE IF NOT EXISTS ${env.PGVECTOR_TABLE} (
          chunk_id text PRIMARY KEY,
          video_id text NOT NULL,
          source_url text NOT NULL,
          text text NOT NULL,
          start_time_seconds integer NOT NULL,
          end_time_seconds integer NOT NULL,
          embedding vector(768) NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        )
      `);

      for (const chunk of chunks) {
        await client.query(
          `
            INSERT INTO ${env.PGVECTOR_TABLE} (
              chunk_id, video_id, source_url, text, start_time_seconds, end_time_seconds, embedding, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (chunk_id)
            DO UPDATE SET
              video_id = EXCLUDED.video_id,
              source_url = EXCLUDED.source_url,
              text = EXCLUDED.text,
              start_time_seconds = EXCLUDED.start_time_seconds,
              end_time_seconds = EXCLUDED.end_time_seconds,
              embedding = EXCLUDED.embedding,
              metadata = EXCLUDED.metadata
          `,
          [
            chunk.chunkId,
            chunk.videoId,
            chunk.sourceUrl,
            chunk.text,
            chunk.startTimeSeconds,
            chunk.endTimeSeconds,
            `[${chunk.embedding.join(',')}]`,
            chunk.metadata
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(queryEmbedding: number[], filters?: { videoId?: 'A' | 'B'; topK?: number }) {
    const topK = filters?.topK ?? 6;
    const whereClause = filters?.videoId ? 'WHERE video_id = $2' : '';
    const params: unknown[] = [`[${queryEmbedding.join(',')}]`];

    if (filters?.videoId) {
      params.push(filters.videoId);
    }

    params.push(topK);

    const result = await this.pool.query(
      `
        SELECT
          chunk_id,
          video_id,
          source_url,
          text,
          start_time_seconds,
          end_time_seconds,
          metadata,
          1 - (embedding <=> $1::vector) AS score
        FROM ${env.PGVECTOR_TABLE}
        ${whereClause}
        ORDER BY embedding <=> $1::vector
        LIMIT $${filters?.videoId ? 3 : 2}
      `,
      params
    );

    return result.rows.map((row) => ({
      chunkId: row.chunk_id,
      videoId: row.video_id,
      sourceUrl: row.source_url,
      text: row.text,
      startTimeSeconds: Number(row.start_time_seconds),
      endTimeSeconds: Number(row.end_time_seconds),
      score: Number(row.score),
      embedding: queryEmbedding,
      metadata: row.metadata ?? {}
    })) as Array<TranscriptChunk & { score: number; embedding: number[]; metadata: Record<string, unknown> }>;
  }
}
