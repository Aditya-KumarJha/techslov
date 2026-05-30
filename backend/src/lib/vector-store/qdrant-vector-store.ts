import { env } from '../../config/env.js';
import type { EmbeddedTranscriptChunk } from './memory-vector-store.js';
import type { TranscriptChunk } from '../transcript/transcript-fetcher.js';
import type { VectorStoreAdapter } from './vector-store.js';

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

  async search(queryEmbedding: number[], filters?: { videoId?: 'A' | 'B'; topK?: number }) {
    const limit = filters?.topK ?? 6;

    await this.ensureCollection();

    const url = `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}/points/search`;
    const body: any = {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      with_vector: true
    };

    if (filters?.videoId) {
      body.filter = { must: [{ key: 'videoId', match: { value: filters.videoId } }] };
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
    const mapped: Array<TranscriptChunk & { score: number; embedding: number[]; metadata: Record<string, unknown> }> = hits.map((h: any) => {
      const payload = h.payload ?? h.point?.payload ?? {};
      const vector = h.vector ?? h.point?.vector ?? [];
      const score = typeof h.score === 'number' ? h.score : 1 - (h.dist ?? 0);

      return {
        chunkId: String(h.id ?? h.point?.id),
        text: payload.text ?? payload.content ?? '',
        startTimeSeconds: payload.startTimeSeconds ?? null,
        endTimeSeconds: payload.endTimeSeconds ?? null,
        videoId: payload.videoId as 'A' | 'B',
        metadata: payload.metadata ?? {},
        score,
        embedding: vector
      };
    });

    return mapped;
  }
}

export default QdrantVectorStore;
