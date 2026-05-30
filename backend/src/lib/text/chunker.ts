import { createHash } from 'node:crypto';

import type { TranscriptChunk } from '../transcript/transcript-fetcher.js';
import type { TranscriptSegment } from '../transcript/transcript.types.js';

type ChunkTranscriptInput = {
  videoId: 'A' | 'B';
  sourceUrl: string;
  text: string;
  chunkSize?: number;
  overlap?: number;
};

type ChunkTranscriptSegmentsInput = {
  videoId: 'A' | 'B';
  sourceUrl: string;
  segments: TranscriptSegment[];
  chunkSize?: number;
  overlapSegments?: number;
};

export function chunkTranscriptFromSegments({
  videoId,
  sourceUrl,
  segments,
  chunkSize = 900,
  overlapSegments = 2
}: ChunkTranscriptSegmentsInput): TranscriptChunk[] {
  const normalizedSegments = segments
    .map((segment) => ({
      ...segment,
      text: segment.text.replace(/\s+/g, ' ').trim()
    }))
    .filter((segment) => segment.text.length > 0);

  if (!normalizedSegments.length) {
    return [];
  }

  const sourceFingerprint = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 10);
  const chunks: TranscriptChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < normalizedSegments.length) {
    let endIndex = startIndex;
    let chunkText = normalizedSegments[startIndex]?.text ?? '';

    while (endIndex + 1 < normalizedSegments.length && chunkText.length < chunkSize) {
      endIndex += 1;
      chunkText = `${chunkText} ${normalizedSegments[endIndex]?.text ?? ''}`.trim();
    }

    const startTimeSeconds = Math.floor(normalizedSegments[startIndex]?.startTimeSeconds ?? 0);
    const endTimeSeconds = Math.ceil(normalizedSegments[endIndex]?.endTimeSeconds ?? startTimeSeconds);

    chunks.push({
      videoId,
      sourceUrl,
      chunkId: `${videoId}_${sourceFingerprint}_chunk_${chunkIndex}`,
      text: chunkText,
      startTimeSeconds,
      endTimeSeconds
    });

    if (endIndex >= normalizedSegments.length - 1) {
      break;
    }

    startIndex = Math.max(startIndex + 1, endIndex - overlapSegments + 1);
    chunkIndex += 1;
  }

  return chunks;
}

export function chunkTranscript({
  videoId,
  sourceUrl,
  text,
  chunkSize = 900,
  overlap = 140
}: ChunkTranscriptInput): TranscriptChunk[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const sourceFingerprint = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 10);

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
        chunkId: `${videoId}_${sourceFingerprint}_chunk_${index}`,
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
