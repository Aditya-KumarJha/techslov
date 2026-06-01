import type { EmbeddedTranscriptChunk } from './memory-vector-store.js';
import type { VectorStoreAdapter } from './vector-store.js';

function isQdrantAccessError(error: unknown) {
  return error instanceof Error && /qdrant/i.test(error.message) && /(403|forbidden)/i.test(error.message);
}

export class ResilientVectorStore implements VectorStoreAdapter {
  private fallbackActivated = false;

  constructor(
    private readonly primary: VectorStoreAdapter,
    private readonly fallback: VectorStoreAdapter
  ) {}

  private shouldFallback(error: unknown) {
    return this.fallbackActivated || isQdrantAccessError(error);
  }

  private activateFallback() {
    this.fallbackActivated = true;
  }

  async upsertChunks(chunks: EmbeddedTranscriptChunk[]): Promise<void> {
    if (this.shouldFallback(undefined)) {
      return this.fallback.upsertChunks(chunks);
    }

    try {
      await this.primary.upsertChunks(chunks);
    } catch (error) {
      if (!this.shouldFallback(error)) {
        throw error;
      }

      this.activateFallback();
      await this.fallback.upsertChunks(chunks);
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
    if (this.shouldFallback(undefined)) {
      return this.fallback.search(queryEmbedding, filters);
    }

    try {
      return await this.primary.search(queryEmbedding, filters);
    } catch (error) {
      if (!this.shouldFallback(error)) {
        throw error;
      }

      this.activateFallback();
      return this.fallback.search(queryEmbedding, filters);
    }
  }

  async listByVideoId(videoId: 'A' | 'B') {
    if (this.shouldFallback(undefined)) {
      return this.fallback.listByVideoId(videoId);
    }

    try {
      return await this.primary.listByVideoId(videoId);
    } catch (error) {
      if (!this.shouldFallback(error)) {
        throw error;
      }

      this.activateFallback();
      return this.fallback.listByVideoId(videoId);
    }
  }

  async listBySourceUrl(sourceUrl: string) {
    if (this.shouldFallback(undefined)) {
      return this.fallback.listBySourceUrl(sourceUrl);
    }

    try {
      return await this.primary.listBySourceUrl(sourceUrl);
    } catch (error) {
      if (!this.shouldFallback(error)) {
        throw error;
      }

      this.activateFallback();
      return this.fallback.listBySourceUrl(sourceUrl);
    }
  }
}
