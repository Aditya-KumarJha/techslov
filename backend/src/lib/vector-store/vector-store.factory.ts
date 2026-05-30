import { env } from '../../config/env.js';
import { MemoryVectorStore } from './memory-vector-store.js';
import { PgvectorVectorStore } from './pgvector-vector-store.js';
import { QdrantVectorStore } from './qdrant-vector-store.js';

export function createVectorStore() {
  if (env.QDRANT_URL) {
    return new QdrantVectorStore();
  }

  if (env.VECTOR_STORE === 'pgvector' && env.DATABASE_URL) {
    return new PgvectorVectorStore();
  }

  if (env.VECTOR_STORE === 'qdrant' && env.QDRANT_URL) {
    return new QdrantVectorStore();
  }

  return new MemoryVectorStore();
}
