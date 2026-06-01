export type VideoId = 'A' | 'B';

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
  transcriptPreview?: string;
  transcriptChunkCount?: number;
};

export type TranscriptEvidence = {
  videoId: VideoId;
  chunkId: string;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  sourceUrl: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

export type Citation = {
  videoId: VideoId;
  chunkId: string;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  sourceUrl: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

export type ConversationTurn = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Citation[];
  transcriptEvidence?: TranscriptEvidence[];
};

export type ConversationSummary = {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  preview: string;
  activeContextIndex: number;
  contextCount: number;
};

export type ConversationVideoContext = {
  contextId: string;
  createdAt: string;
  videoA: SocialVideoMetadata;
  videoB: SocialVideoMetadata;
};

export type ConversationThread = ConversationSummary & {
  turns: ConversationTurn[];
  contexts: ConversationVideoContext[];
};

export type UpdateConversationTitleRequest = {
  title: string;
};

export type UpdateConversationContextIndexRequest = {
  activeContextIndex: number;
};
