import { chunkTranscript, chunkTranscriptFromSegments } from '../../lib/text/chunker.js';
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
  let metadata;
  try {
    metadata = await container.transcriptFetcher.fetchMetadata(sourceUrl);
  } catch (error) {
    throw new Error(
      `Failed to fetch metadata for video ${videoId} from ${sourceUrl}: ${error instanceof Error ? error.message : 'Unknown metadata error'}`
    );
  }

  let transcriptSegments: TranscriptSegment[];
  try {
    transcriptSegments = await container.transcriptFetcher.fetchTranscript(sourceUrl);
  } catch (error) {
    throw new Error(
      `Failed to fetch transcript for video ${videoId} from ${sourceUrl}: ${error instanceof Error ? error.message : 'Unknown transcript error'}`
    );
  }

  const durationSeconds = Math.round(metadata.durationSeconds);
  const transcriptText = transcriptSegments.map((segment) => segment.text).join(' ').trim();
  const transcriptPreview = transcriptText.slice(0, 180);
  const transcriptChunks = transcriptSegments.length
    ? chunkTranscriptFromSegments({
      videoId,
      sourceUrl,
      segments: transcriptSegments
    })
    : chunkTranscript({
      videoId,
      sourceUrl,
      text: transcriptText
    });

  let embeddings;
  try {
    embeddings = await container.embeddings.embedDocuments(transcriptChunks.map((chunk) => chunk.text));
  } catch (error) {
    throw new Error(
      `Failed to embed transcript chunks for video ${videoId} from ${sourceUrl}: ${error instanceof Error ? error.message : 'Unknown embedding error'}`
    );
  }

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

  try {
    await container.vectorStore.upsertChunks(enrichedChunks);
  } catch (error) {
    throw new Error(
      `Failed to store transcript chunks for video ${videoId} from ${sourceUrl}: ${error instanceof Error ? error.message : 'Unknown vector-store error'}`
    );
  }

  const engagementRate = calculateEngagementRate(metadata.views, metadata.likes, metadata.comments);

  const storedVideo: IngestedVideo = {
    videoId,
    sourceUrl,
    title: metadata.title,
    creator: metadata.creator,
    followerCount: metadata.followerCount,
    views: metadata.views,
    likes: metadata.likes,
    comments: metadata.comments,
    hashtags: metadata.hashtags,
    description: metadata.description,
    uploadDate: metadata.uploadDate,
    durationSeconds,
    engagementRate,
    transcriptChunkCount: transcriptChunks.length,
    transcriptPreview
  };

  try {
    await container.videoRegistry.upsert({
      ...storedVideo,
      transcript: transcriptText,
      transcriptPreview,
      transcriptChunkCount: transcriptChunks.length
    });
  } catch (error) {
    throw new Error(
      `Failed to persist video metadata for video ${videoId} from ${sourceUrl}: ${error instanceof Error ? error.message : 'Unknown persistence error'}`
    );
  }

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
