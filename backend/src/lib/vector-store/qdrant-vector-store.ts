import { env } from '../../config/env.js';
import type { EmbeddedTranscriptChunk } from './memory-vector-store.js';
import type { VectorStoreAdapter } from './vector-store.js';
import type { TranscriptEvidenceChunk } from './vector-store.js';

function authHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (env.QDRANT_API_KEY) {
    headers['x-api-key'] = env.QDRANT_API_KEY;
    headers['Authorization'] = `ApiKey ${env.QDRANT_API_KEY}`;
  }

  return headers;
}

export class QdrantVectorStore implements VectorStoreAdapter {
  private readonly baseUrl: string;
  private readonly collection: string;

  constructor() {
    if (!env.QDRANT_URL) {
      throw new Error('QDRANT_URL is required for the qdrant vector store');
    }

    this.baseUrl = env.QDRANT_URL.replace(/\/+$/u, '');
    // reuse the same collection name as PGVECTOR_TABLE for parity
    this.collection = env.PGVECTOR_TABLE || 'video_chunks';
  }

  private async ensureCollection() {
    const url = `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders()
    });

    if (response.ok) {
      return;
    }

    const createResponse = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(this.collection)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      })
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Qdrant collection setup failed: ${createResponse.status} ${text}`);
    }
  }

  async upsertChunks(chunks: EmbeddedTranscriptChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    await this.ensureCollection();

    const points = chunks.map((c) => ({
      id: c.chunkId,
      vector: c.embedding,
      payload: {
        text: c.text,
        videoId: c.videoId,
        sourceUrl: c.sourceUrl ?? null,
        startTimeSeconds: c.startTimeSeconds ?? null,
        endTimeSeconds: c.endTimeSeconds ?? null,
        metadata: c.metadata ?? {}
      }
    }));

    const url = `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}/points?wait=true`;

    await fetch(url, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ points })
    });
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
    const limit = filters?.topK ?? 6;

    await this.ensureCollection();

    const url = `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}/points/search`;
    const body: any = {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      with_vector: true
    };

    const filterMust: any[] = [];
    if (filters?.videoId) {
      filterMust.push({ key: 'videoId', match: { value: filters.videoId } });
    }
    if (filters?.sourceUrl) {
      filterMust.push({ key: 'sourceUrl', match: { value: filters.sourceUrl } });
    }
    if (filters?.sourceUrls && filters.sourceUrls.length > 0) {
      filterMust.push({
        should: filters.sourceUrls.map((url) => ({ key: 'sourceUrl', match: { value: url } }))
      });
    }

    if (filterMust.length > 0) {
      body.filter = { must: filterMust };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Qdrant search failed: ${res.status} ${text}`);
    }

    const json = await res.json();

    // Qdrant returns an array of results in `result` or `points`
    const hits = json.result ?? json.points ?? [];

    // normalize to TranscriptChunk shape
    const mapped: TranscriptEvidenceChunk[] = hits.map((h: any) => {
      const payload = h.payload ?? h.point?.payload ?? {};
      const vector = h.vector ?? h.point?.vector ?? [];
      const score = typeof h.score === 'number' ? h.score : 1 - (h.dist ?? 0);

      return {
        chunkId: String(h.id ?? h.point?.id),
        text: payload.text ?? payload.content ?? '',
        startTimeSeconds: payload.startTimeSeconds ?? null,
        endTimeSeconds: payload.endTimeSeconds ?? null,
        videoId: payload.videoId as 'A' | 'B',
        sourceUrl: payload.sourceUrl ?? '',
        metadata: payload.metadata ?? {},
        score,
        embedding: vector
      };
    });

    return mapped;
  }

  async listByVideoId(videoId: 'A' | 'B'): Promise<TranscriptEvidenceChunk[]> {
    await this.ensureCollection();

    const url = `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}/points/scroll`;
    const chunks: TranscriptEvidenceChunk[] = [];
    let nextOffset: string | number | null = null;

    do {
      const body: Record<string, unknown> = {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: nextOffset ?? undefined,
        filter: { must: [{ key: 'videoId', match: { value: videoId } }] }
      };

      const res: Response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Qdrant scroll failed: ${res.status} ${text}`);
      }

      const json: any = await res.json();
      const hits = json.result?.points ?? json.result ?? [];

      for (const hit of hits) {
        const payload = hit.payload ?? hit.point?.payload ?? {};

        chunks.push({
          chunkId: String(hit.id ?? hit.point?.id),
          text: payload.text ?? payload.content ?? '',
          startTimeSeconds: payload.startTimeSeconds ?? 0,
          endTimeSeconds: payload.endTimeSeconds ?? 0,
          videoId: payload.videoId as 'A' | 'B',
          sourceUrl: payload.sourceUrl ?? '',
          metadata: payload.metadata ?? {}
        });
      }

      nextOffset = json.result?.next_page_offset ?? null;
    } while (nextOffset != null);

    return chunks
      .filter((chunk) => chunk.text.length > 0)
      .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
  }

  async listBySourceUrl(sourceUrl: string): Promise<TranscriptEvidenceChunk[]> {
    await this.ensureCollection();

    const url = `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}/points/scroll`;
    const chunks: TranscriptEvidenceChunk[] = [];
    let nextOffset: string | number | null = null;

    do {
      const body: Record<string, unknown> = {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: nextOffset ?? undefined,
        filter: { must: [{ key: 'sourceUrl', match: { value: sourceUrl } }] }
      };

      const res: Response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Qdrant scroll failed: ${res.status} ${text}`);
      }

      const json: any = await res.json();
      const hits = json.result?.points ?? json.result ?? [];

      for (const hit of hits) {
        const payload = hit.payload ?? hit.point?.payload ?? {};

        chunks.push({
          chunkId: String(hit.id ?? hit.point?.id),
          text: payload.text ?? payload.content ?? '',
          startTimeSeconds: payload.startTimeSeconds ?? 0,
          endTimeSeconds: payload.endTimeSeconds ?? 0,
          videoId: payload.videoId as 'A' | 'B',
          sourceUrl: payload.sourceUrl ?? '',
          metadata: payload.metadata ?? {}
        });
      }

      nextOffset = json.result?.next_page_offset ?? null;
    } while (nextOffset != null);

    return chunks
      .filter((chunk) => chunk.text.length > 0)
      .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
  }
}

export default QdrantVectorStore;
