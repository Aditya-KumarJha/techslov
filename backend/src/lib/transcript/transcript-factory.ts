import { env } from '../../config/env.js';
import { DeterministicEmbeddingsProvider } from '../embeddings/deterministic-embeddings-provider.js';
import { GeminiEmbeddingsProvider } from '../embeddings/gemini-embeddings-provider.js';
import type { EmbeddingsProvider } from '../embeddings/embeddings-provider.js';
import { YtDlpTranscriptFetcher } from './yt-dlp-transcript-fetcher.js';

export function createTranscriptFetcher() {
  return new YtDlpTranscriptFetcher();
}

export function createEmbeddingsProvider(): EmbeddingsProvider {
  if (env.GEMINI_API_KEY) {
    try {
      return new GeminiEmbeddingsProvider();
    } catch {
      return new DeterministicEmbeddingsProvider();
    }
  }

  return new DeterministicEmbeddingsProvider();
}
