import type { TranscriptChunk } from '../transcript/transcript-fetcher.js';
import { cosineSimilarity } from '../similarity/cosine.js';
import type { TranscriptEvidenceChunk } from './vector-store.js';

export type EmbeddedTranscriptChunk = TranscriptChunk & {
  embedding: number[];
  metadata: Record<string, unknown>;
};

export class MemoryVectorStore {
  private readonly documents: EmbeddedTranscriptChunk[] = [];

  async upsertChunks(chunks: EmbeddedTranscriptChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const existingIndex = this.documents.findIndex((document) => document.chunkId === chunk.chunkId);

      if (existingIndex >= 0) {
        this.documents[existingIndex] = chunk;
      } else {
        this.documents.push(chunk);
      }
    }
  }

  async search(queryEmbedding: number[], filters?: { videoId?: 'A' | 'B'; topK?: number }) {
    const topK = filters?.topK ?? 6;
    const filteredDocuments = this.documents.filter((document) => {
      if (!filters?.videoId) {
        return true;
      }

      return document.videoId === filters.videoId;
    });

    return filteredDocuments
      .map((document) => ({
        ...document,
        score: cosineSimilarity(queryEmbedding, document.embedding)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  async listByVideoId(videoId: 'A' | 'B'): Promise<TranscriptEvidenceChunk[]> {
    return this.documents
      .filter((document) => document.videoId === videoId)
      .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds)
      .map((document) => ({
        ...document,
        score: undefined
      }));
  }
}
