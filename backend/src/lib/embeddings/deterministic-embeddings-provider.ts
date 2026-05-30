import { createHash } from 'node:crypto';

import type { EmbeddingsProvider } from './embeddings-provider.js';

const VECTOR_DIMENSION = 768;

function embedText(text: string): number[] {
  const hash = createHash('sha256').update(text).digest();
  const vector = new Array<number>(VECTOR_DIMENSION).fill(0);

  for (let index = 0; index < VECTOR_DIMENSION; index += 1) {
    const byte = hash[index % hash.length] ?? 0;
    vector[index] = (byte / 255) * 2 - 1;
  }

  return vector;
}

export class DeterministicEmbeddingsProvider implements EmbeddingsProvider {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((text) => embedText(text));
  }

  async embedQuery(text: string): Promise<number[]> {
    return embedText(text);
  }
}
