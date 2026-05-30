import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('social-rag-backend'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-2'),
  DATABASE_URL: z.string().optional(),
  VECTOR_STORE: z.enum(['pgvector', 'qdrant', 'chroma', 'pinecone', 'weaviate']).default('pgvector'),
  PGVECTOR_TABLE: z.string().default('video_chunks'),
  YOUTUBE_TRANSCRIPT_API_KEY: z.string().optional(),
  INSTAGRAM_COOKIE_FILE: z.string().optional(),
  QDRANT_URL: z.string().optional(),
  QDRANT_API_KEY: z.string().optional()
});

export const env = envSchema.parse(process.env);
