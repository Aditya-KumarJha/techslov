import { env } from '../../config/env.js';
import { MemoryVectorStore } from './memory-vector-store.js';
import { PgvectorVectorStore } from './pgvector-vector-store.js';
import { QdrantVectorStore } from './qdrant-vector-store.js';
import { ResilientVectorStore } from './resilient-vector-store.js';

export function createVectorStore(options?: { pgvectorAvailable?: boolean }) {
  const pgvectorAvailable = options?.pgvectorAvailable ?? true;

  if (env.VECTOR_STORE === 'pgvector' && env.DATABASE_URL) {
    if (!pgvectorAvailable) {
      return new MemoryVectorStore();
    }

    return new PgvectorVectorStore();
  }

  if (env.VECTOR_STORE === 'qdrant' && env.QDRANT_URL && env.DATABASE_URL) {
    return new ResilientVectorStore(new QdrantVectorStore(), new PgvectorVectorStore());
  }

  if (env.VECTOR_STORE === 'qdrant' && env.QDRANT_URL) {
    return new QdrantVectorStore();
  }

  if (env.QDRANT_URL && env.DATABASE_URL && env.VECTOR_STORE !== 'pgvector') {
    return new ResilientVectorStore(new QdrantVectorStore(), new PgvectorVectorStore());
  }

  return new MemoryVectorStore();
}
