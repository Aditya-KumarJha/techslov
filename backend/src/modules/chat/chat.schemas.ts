import { z } from 'zod';

export const chatMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  videoIds: z.array(z.enum(['A', 'B'])).optional()
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
