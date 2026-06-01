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

  async search(
    queryEmbedding: number[],
    filters?: {
      videoId?: 'A' | 'B';
      sourceUrl?: string;
      sourceUrls?: string[];
      topK?: number;
    }
  ) {
    const topK = filters?.topK ?? 6;
    const filteredDocuments = this.documents.filter((document) => {
      if (filters?.videoId && document.videoId !== filters.videoId) {
        return false;
      }
      if (filters?.sourceUrl && document.sourceUrl !== filters.sourceUrl) {
        return false;
      }
      if (filters?.sourceUrls && !filters.sourceUrls.includes(document.sourceUrl)) {
        return false;
      }
      return true;
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

  async listBySourceUrl(sourceUrl: string): Promise<TranscriptEvidenceChunk[]> {
    return this.documents
      .filter((document) => document.sourceUrl === sourceUrl)
      .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds)
      .map((document) => ({
        ...document,
        score: undefined
      }));
  }
}
