export type VideoId = "A" | "B";

export type SocialVideoMetadata = {
  videoId: VideoId;
  sourceUrl: string;
  title: string;
  creator: string;
  followerCount: number;
  views: number;
  likes: number;
  comments: number;
  hashtags: string[];
  description: string;
  uploadDate: string;
  durationSeconds: number;
  engagementRate: number;
  transcriptPreview: string;
  transcriptChunkCount?: number;
};

export type Citation = {
  videoId: VideoId;
  chunkId: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
};

export type RetrievedChunk = {
  videoId: VideoId;
  chunkId: string;
  text: string;
  score: number;
  sourceUrl: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  metadata: Record<string, unknown>;
};

export type IngestJob = {
  jobId: string;
  status: "completed";
  chunkCount: number;
  videos: SocialVideoMetadata[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

export type ChatRequest = {
  conversationId?: string;
  message: string;
  videoIds?: VideoId[];
};

export type ChatResponse = {
  conversationId: string;
  answer: string;
  citations: Citation[];
  retrievedChunks: RetrievedChunk[];
};
