import type { TranscriptChunk } from '../transcript/transcript-fetcher.js';

type ChunkTranscriptInput = {
  videoId: 'A' | 'B';
  sourceUrl: string;
  text: string;
  chunkSize?: number;
  overlap?: number;
};

export function chunkTranscript({
  videoId,
  sourceUrl,
  text,
  chunkSize = 900,
  overlap = 140
}: ChunkTranscriptInput): TranscriptChunk[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (!normalizedText) {
    return [];
  }

  const chunks: TranscriptChunk[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < normalizedText.length) {
    const end = Math.min(normalizedText.length, cursor + chunkSize);
    const chunkText = normalizedText.slice(cursor, end).trim();

    if (chunkText) {
      chunks.push({
        videoId,
        sourceUrl,
        chunkId: `${videoId}_chunk_${index}`,
        text: chunkText,
        startTimeSeconds: Math.floor((cursor / normalizedText.length) * 100),
        endTimeSeconds: Math.floor((end / normalizedText.length) * 100)
      });
    }

    if (end >= normalizedText.length) {
      break;
    }

    cursor = Math.max(0, end - overlap);
    index += 1;
  }

  return chunks;
}
