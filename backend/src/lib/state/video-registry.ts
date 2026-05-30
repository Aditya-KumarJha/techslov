import type { Pool } from 'pg';

import type { SocialVideoMetadata } from '../../types/api.js';

export type StoredVideo = SocialVideoMetadata & {
  sourceUrl: string;
  transcript: string;
  transcriptChunkCount: number;
  engagementRate: number;
  transcriptPreview: string;
};

export class VideoRegistry {
  private readonly videos = new Map<'A' | 'B', StoredVideo>();

  constructor(private readonly pool: Pool) {}

  async hydrate() {
    const result = await this.pool.query(
      `
        SELECT
          video_id,
          source_url,
          title,
          creator,
          follower_count,
          views,
          likes,
          comments,
          hashtags,
          description,
          upload_date,
          duration_seconds,
          engagement_rate,
          transcript_preview,
          transcript,
          transcript_chunk_count
        FROM videos
        ORDER BY video_id ASC
      `
    );

    this.videos.clear();

    for (const row of result.rows) {
      this.videos.set(row.video_id, {
        videoId: row.video_id,
        sourceUrl: row.source_url,
        title: row.title,
        creator: row.creator,
        followerCount: Number(row.follower_count),
        views: Number(row.views),
        likes: Number(row.likes),
        comments: Number(row.comments),
        hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
        description: row.description,
        uploadDate: row.upload_date,
        durationSeconds: Number(row.duration_seconds),
        engagementRate: Number(row.engagement_rate),
        transcriptPreview: row.transcript_preview,
        transcript: row.transcript,
        transcriptChunkCount: Number(row.transcript_chunk_count)
      });
    }
  }

  async upsert(video: StoredVideo) {
    await this.pool.query(
      `
        INSERT INTO videos (
          video_id,
          source_url,
          title,
          creator,
          follower_count,
          views,
          likes,
          comments,
          hashtags,
          description,
          upload_date,
          duration_seconds,
          engagement_rate,
          transcript_preview,
          transcript,
          transcript_chunk_count,
          updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,now())
        ON CONFLICT (video_id) DO UPDATE SET
          source_url = EXCLUDED.source_url,
          title = EXCLUDED.title,
          creator = EXCLUDED.creator,
          follower_count = EXCLUDED.follower_count,
          views = EXCLUDED.views,
          likes = EXCLUDED.likes,
          comments = EXCLUDED.comments,
          hashtags = EXCLUDED.hashtags,
          description = EXCLUDED.description,
          upload_date = EXCLUDED.upload_date,
          duration_seconds = EXCLUDED.duration_seconds,
          engagement_rate = EXCLUDED.engagement_rate,
          transcript_preview = EXCLUDED.transcript_preview,
          transcript = EXCLUDED.transcript,
          transcript_chunk_count = EXCLUDED.transcript_chunk_count,
          updated_at = now()
      `,
      [
        video.videoId,
        video.sourceUrl,
        video.title,
        video.creator,
        video.followerCount,
        video.views,
        video.likes,
        video.comments,
        JSON.stringify(video.hashtags),
        video.description,
        video.uploadDate,
        video.durationSeconds,
        video.engagementRate,
        video.transcriptPreview,
        video.transcript,
        video.transcriptChunkCount
      ]
    );

    this.videos.set(video.videoId, video);
  }

  get(videoId: 'A' | 'B') {
    return this.videos.get(videoId);
  }

  list() {
    return [...this.videos.values()].sort((left, right) => left.videoId.localeCompare(right.videoId));
  }
}
