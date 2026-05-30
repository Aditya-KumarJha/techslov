export type TranscriptChunk = {
  videoId: 'A' | 'B';
  sourceUrl: string;
  chunkId: string;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
};

export interface TranscriptFetcher {
  fetchTranscript(videoUrl: string): Promise<TranscriptChunk[]>;
}
