import type { Pool } from 'pg';

export type IngestJobHistory = {
  jobId: string;
  status: 'completed' | 'failed';
  createdAt: string;
  completedAt: string;
  chunkCount: number;
  videos: Array<{
    videoId: 'A' | 'B';
    sourceUrl: string;
    creator: string;
    engagementRate: number;
    transcriptChunkCount: number;
    transcriptPreview: string;
  }>;
};

export class JobHistoryStore {
  constructor(private readonly pool: Pool) {}

  async append(job: IngestJobHistory): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO ingest_jobs (
          job_id,
          status,
          created_at,
          completed_at,
          chunk_count,
          videos
        ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
        ON CONFLICT (job_id) DO UPDATE SET
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          completed_at = EXCLUDED.completed_at,
          chunk_count = EXCLUDED.chunk_count,
          videos = EXCLUDED.videos
      `,
      [job.jobId, job.status, job.createdAt, job.completedAt, job.chunkCount, JSON.stringify(job.videos)]
    );
  }

  async list(): Promise<IngestJobHistory[]> {
    const result = await this.pool.query(
      `
        SELECT job_id, status, created_at, completed_at, chunk_count, videos
        FROM ingest_jobs
        ORDER BY completed_at DESC
      `
    );

    return result.rows.map((row) => ({
      jobId: row.job_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      completedAt: row.completed_at.toISOString(),
      chunkCount: Number(row.chunk_count),
      videos: Array.isArray(row.videos) ? row.videos : []
    }));
  }

  async get(jobId: string): Promise<IngestJobHistory | undefined> {
    const result = await this.pool.query(
      `
        SELECT job_id, status, created_at, completed_at, chunk_count, videos
        FROM ingest_jobs
        WHERE job_id = $1
      `,
      [jobId]
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return {
      jobId: row.job_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      completedAt: row.completed_at.toISOString(),
      chunkCount: Number(row.chunk_count),
      videos: Array.isArray(row.videos) ? row.videos : []
    };
  }
}
