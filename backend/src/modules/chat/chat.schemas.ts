import { z } from 'zod';

import type { ConversationTurn, ConversationVideoContext, SocialVideoMetadata } from '../../types/api.js';

const socialVideoSchema: z.ZodType<SocialVideoMetadata> = z.object({
  videoId: z.enum(['A', 'B']),
  sourceUrl: z.string(),
  title: z.string(),
  creator: z.string(),
  followerCount: z.number(),
  views: z.number(),
  likes: z.number(),
  comments: z.number(),
  hashtags: z.array(z.string()),
  description: z.string(),
  uploadDate: z.string(),
  durationSeconds: z.number(),
  transcriptPreview: z.string().optional(),
  transcriptChunkCount: z.number().optional()
});

const conversationContextSchema: z.ZodType<ConversationVideoContext> = z.object({
  contextId: z.string(),
  createdAt: z.string(),
  videoA: socialVideoSchema,
  videoB: socialVideoSchema
});

const conversationTurnSchema: z.ZodType<Pick<ConversationTurn, 'role' | 'content'>> = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
});

export const chatMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  videoIds: z.array(z.enum(['A', 'B'])).optional(),
  videoContext: conversationContextSchema.optional(),
  history: z.array(conversationTurnSchema).optional()
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
