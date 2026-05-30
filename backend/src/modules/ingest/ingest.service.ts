import { chunkTranscript } from '../../lib/text/chunker.js';
import { getAppContainer } from '../../lib/runtime/app-container.js';
import type { TranscriptSegment } from '../../lib/transcript/transcript.types.js';
import type { SocialVideoMetadata } from '../../types/api.js';
import type { IngestRequest } from './ingest.schemas.js';

type IngestedVideo = SocialVideoMetadata & {
  sourceUrl: string;
  transcriptChunkCount: number;
  transcriptPreview: string;
  engagementRate: number;
};

export type IngestJob = {
  jobId: string;
  status: 'completed';
  videos: IngestedVideo[];
  chunkCount: number;
};

function calculateEngagementRate(views: number, likes: number, comments: number) {
  if (views <= 0) {
    return 0;
  }

  return ((likes + comments) / views) * 100;
}

async function ingestVideo(videoId: 'A' | 'B', sourceUrl: string): Promise<IngestedVideo> {
  const container = getAppContainer();
  const metadata = await container.transcriptFetcher.fetchMetadata(sourceUrl);
  const transcriptSegments: TranscriptSegment[] = await container.transcriptFetcher.fetchTranscript(sourceUrl);
  const transcriptText = transcriptSegments.map((segment) => segment.text).join(' ').trim();
  const transcriptPreview = transcriptText.slice(0, 180);
  const transcriptChunks = chunkTranscript({
    videoId,
    sourceUrl,
    text: transcriptText
  });
  const embeddings = await container.embeddings.embedDocuments(transcriptChunks.map((chunk) => chunk.text));
  const enrichedChunks = transcriptChunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index] ?? [],
    metadata: {
      title: metadata.title,
      creator: metadata.creator,
      uploadDate: metadata.uploadDate,
      engagementRate: calculateEngagementRate(metadata.views, metadata.likes, metadata.comments)
    }
  }));

  await container.vectorStore.upsertChunks(enrichedChunks);

  const engagementRate = calculateEngagementRate(metadata.views, metadata.likes, metadata.comments);

  const storedVideo: IngestedVideo = {
    videoId,
    sourceUrl,
    creator: metadata.creator,
    followerCount: metadata.followerCount,
    views: metadata.views,
    likes: metadata.likes,
    comments: metadata.comments,
    hashtags: metadata.hashtags,
    uploadDate: metadata.uploadDate,
    durationSeconds: metadata.durationSeconds,
    engagementRate,
    transcriptChunkCount: transcriptChunks.length,
    transcriptPreview
  };

  await container.videoRegistry.upsert({
    ...storedVideo,
    transcript: transcriptText,
    transcriptPreview,
    transcriptChunkCount: transcriptChunks.length
  });

  return storedVideo;
}

export async function createIngestJob(payload: IngestRequest): Promise<IngestJob> {
  const createdAt = new Date().toISOString();
  const [videoA, videoB] = await Promise.all([
    ingestVideo('A', payload.youtubeUrl),
    ingestVideo('B', payload.instagramUrl)
  ]);

  const jobId = `ingest_${Date.now()}`;
  const completedAt = new Date().toISOString();
  const container = getAppContainer();
  await container.jobHistoryStore.append({
    jobId,
    status: 'completed',
    createdAt,
    completedAt,
    chunkCount: videoA.transcriptChunkCount + videoB.transcriptChunkCount,
    videos: [videoA, videoB].map((video) => ({
      videoId: video.videoId,
      sourceUrl: video.sourceUrl,
      creator: video.creator,
      engagementRate: video.engagementRate,
      transcriptChunkCount: video.transcriptChunkCount,
      transcriptPreview: video.transcriptPreview
    }))
  });

  return {
    jobId,
    status: 'completed',
    videos: [videoA, videoB],
    chunkCount: videoA.transcriptChunkCount + videoB.transcriptChunkCount
  };
}
