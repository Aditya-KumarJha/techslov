import type { TranscriptChunk } from '../transcript/transcript-fetcher.js';
import type { EmbeddedTranscriptChunk } from './memory-vector-store.js';

export type TranscriptEvidenceChunk = TranscriptChunk & {
  metadata: Record<string, unknown>;
  score?: number;
  embedding?: number[];
};

export interface VectorStoreAdapter {
  upsertChunks(chunks: EmbeddedTranscriptChunk[]): Promise<void>;
  search(
    queryEmbedding: number[],
    filters?: {
      videoId?: 'A' | 'B';
      sourceUrl?: string;
      sourceUrls?: string[];
      topK?: number;
    }
  ): Promise<TranscriptEvidenceChunk[]>;
  listByVideoId(videoId: 'A' | 'B'): Promise<TranscriptEvidenceChunk[]>;
  listBySourceUrl(sourceUrl: string): Promise<TranscriptEvidenceChunk[]>;
}
