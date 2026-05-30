import { createEmbeddingsProvider, createTranscriptFetcher } from '../transcript/transcript-factory.js';
import { createVectorStore } from '../vector-store/vector-store.factory.js';
import { ConversationStore } from '../state/conversation-store.js';
import { JobHistoryStore } from '../state/job-history-store.js';
import { VideoRegistry } from '../state/video-registry.js';
import { createRagEngine } from '../rag/rag-engine.js';
import { getDatabasePool } from '../db/pool.js';
import { canUsePgvector, ensureDatabaseSchema } from '../db/schema.js';

export type AppContainer = {
  embeddings: ReturnType<typeof createEmbeddingsProvider>;
  vectorStore: ReturnType<typeof createVectorStore>;
  transcriptFetcher: ReturnType<typeof createTranscriptFetcher>;
  videoRegistry: VideoRegistry;
  conversationStore: ConversationStore;
  jobHistoryStore: JobHistoryStore;
  ragEngine: ReturnType<typeof createRagEngine>;
  pool: ReturnType<typeof getDatabasePool>;
};

let singleton: AppContainer | undefined;

export async function initializeAppContainer(): Promise<AppContainer> {
  if (singleton) {
    return singleton;
  }

  const pool = getDatabasePool();
  const pgvectorAvailable = await canUsePgvector(pool);
  await ensureDatabaseSchema(pool, { pgvectorAvailable });

  const embeddings = createEmbeddingsProvider();
  const vectorStore = createVectorStore({ pgvectorAvailable });
  const transcriptFetcher = createTranscriptFetcher();
  const videoRegistry = new VideoRegistry(pool);
  const conversationStore = new ConversationStore(pool);
  const jobHistoryStore = new JobHistoryStore(pool);

  await videoRegistry.hydrate();

  const ragEngine = createRagEngine({
    embeddings,
    vectorStore,
    conversationStore,
    videoRegistry
  });

  const container: AppContainer = {
    embeddings,
    vectorStore,
    transcriptFetcher,
    videoRegistry,
    conversationStore,
    jobHistoryStore,
    ragEngine,
    pool
  };

  singleton = container;

  return container;
}

export function getAppContainer() {
  if (!singleton) {
    throw new Error('App container has not been initialized');
  }

  return singleton;
}
