import type { TranscriptChunk } from '../transcript/transcript-fetcher.js';
import type { EmbeddedTranscriptChunk } from './memory-vector-store.js';

export interface VectorStoreAdapter {
  upsertChunks(chunks: EmbeddedTranscriptChunk[]): Promise<void>;
  search(queryEmbedding: number[], filters?: { videoId?: 'A' | 'B'; topK?: number }): Promise<Array<TranscriptChunk & { score: number; embedding: number[]; metadata: Record<string, unknown> }>>;
}
