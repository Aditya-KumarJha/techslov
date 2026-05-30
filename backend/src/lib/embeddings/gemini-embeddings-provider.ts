import { env } from '../../config/env.js';
import type { EmbeddingsProvider } from './embeddings-provider.js';

type GeminiEmbedResponse = {
  embeddings?: Array<{ values?: number[] }>;
  embedding?: { values?: number[] };
};

async function embedText(text: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for the Gemini embeddings provider');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: `task: search result | query: ${text}` }]
        },
        outputDimensionality: 768
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini embeddings request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GeminiEmbedResponse;
  return payload.embedding?.values ?? payload.embeddings?.[0]?.values ?? [];
}

export class GeminiEmbeddingsProvider implements EmbeddingsProvider {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      embeddings.push(await embedText(`title: none | text: ${text}`));
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    return embedText(`query: ${text}`);
  }
}
