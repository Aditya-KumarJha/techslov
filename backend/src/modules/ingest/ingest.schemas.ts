import { z } from 'zod';

export const ingestRequestSchema = z.object({
  youtubeUrl: z.string().url(),
  instagramUrl: z.string().url()
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
