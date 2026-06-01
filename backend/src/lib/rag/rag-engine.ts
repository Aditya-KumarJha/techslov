import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { EmbeddingsProvider } from '../embeddings/embeddings-provider.js';
import { GeminiLlm } from '../llm/gemini-llm.js';
import type { ConversationStore } from '../state/conversation-store.js';
import type { VideoRegistry } from '../state/video-registry.js';
import type { VectorStoreAdapter } from '../vector-store/vector-store.js';
import type {
  Citation,
  ConversationTurn,
  ConversationVideoContext,
  TranscriptEvidence,
  VideoId
} from '../../types/api.js';

type RetrievedChunk = {
  videoId: VideoId;
  chunkId: string;
  text: string;
  score: number;
  sourceUrl: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  metadata: Record<string, unknown>;
};

type EvidenceInspection = {
  retrievedChunks: RetrievedChunk[];
  transcriptEvidence: TranscriptEvidence[];
  citations: Citation[];
};

type PromptTurn = Pick<ConversationTurn, 'role' | 'content'>;

type RagState = {
  clerkUserId: string | null;
  persist: boolean;
  conversationId: string;
  question: string;
  videoIds: VideoId[];
  context: ConversationVideoContext | null;
  conversationHistory: PromptTurn[];
  retrievedChunks: RetrievedChunk[];
  transcriptEvidence: TranscriptEvidence[];
  answer: string;
  citations: Citation[];
};

type AnswerInput = Partial<
  Pick<RagState, 'conversationId' | 'videoIds' | 'context' | 'conversationHistory'> & {
    history: PromptTurn[];
    clerkUserId: string | null;
    persist: boolean;
  }
>;

export type RagDependencies = {
  embeddings: EmbeddingsProvider;
  vectorStore: VectorStoreAdapter;
  conversationStore: ConversationStore;
  videoRegistry: VideoRegistry;
};

const RagAnnotation = Annotation.Root({
  clerkUserId: Annotation<string | null>(),
  persist: Annotation<boolean>(),
  conversationId: Annotation<string>(),
  question: Annotation<string>(),
  videoIds: Annotation<VideoId[]>(),
  context: Annotation<ConversationVideoContext | null>(),
  conversationHistory: Annotation<PromptTurn[]>(),
  retrievedChunks: Annotation<RetrievedChunk[]>(),
  transcriptEvidence: Annotation<TranscriptEvidence[]>(),
  answer: Annotation<string>(),
  citations: Annotation<Citation[]>()
});

function formatCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    videoId: chunk.videoId,
    chunkId: chunk.chunkId,
    text: chunk.text,
    startTimeSeconds: chunk.startTimeSeconds,
    endTimeSeconds: chunk.endTimeSeconds,
    sourceUrl: chunk.sourceUrl,
    score: chunk.score,
    metadata: chunk.metadata
  }));
}

async function collectTranscriptEvidence(videoIds: VideoId[], vectorStore: VectorStoreAdapter) {
  const chunks = await Promise.all(videoIds.map(async (videoId) => vectorStore.listByVideoId(videoId)));

  return chunks
    .flat()
    .sort((left, right) => {
      if (left.videoId !== right.videoId) {
        return left.videoId.localeCompare(right.videoId);
      }

      return left.startTimeSeconds - right.startTimeSeconds;
    })
    .map((chunk) => ({
      videoId: chunk.videoId,
      chunkId: chunk.chunkId,
      text: chunk.text,
      startTimeSeconds: chunk.startTimeSeconds,
      endTimeSeconds: chunk.endTimeSeconds,
      sourceUrl: chunk.sourceUrl,
      score: chunk.score,
      metadata: chunk.metadata
    }));
}

async function inspectQuestionEvidence(
  question: string,
  dependencies: RagDependencies,
  input?: Partial<Pick<RagState, 'videoIds' | 'context'>>
): Promise<EvidenceInspection> {
  const videoIds = input?.videoIds ?? ['A', 'B'];
  const resolvedContext = input?.context ?? null;
  const queryEmbedding = await dependencies.embeddings.embedQuery(question);
  const firstFiveQuestion = isFirstFiveSecondsQuestion(question);
  const relevantChunks = await dependencies.vectorStore.search(queryEmbedding, {
    videoId: videoIds.length === 1 ? videoIds[0] : undefined,
    topK: firstFiveQuestion ? 20 : 6
  });

  const retrievedChunks = firstFiveQuestion
    ? relevantChunks
      .filter((chunk) => chunk.startTimeSeconds <= 8)
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
      .slice(0, 8)
    : relevantChunks;

  const transcriptEvidence = await collectTranscriptEvidence(videoIds, dependencies.vectorStore);

  const citations = retrievedChunks.length
    ? formatCitations(retrievedChunks as RetrievedChunk[])
    : ((): Citation[] => {
        const metaCites: Citation[] = [];
        const videoA = resolvedContext?.videoA ?? dependencies.videoRegistry.get('A');
        const videoB = resolvedContext?.videoB ?? dependencies.videoRegistry.get('B');

        if (videoA) {
          metaCites.push({
            videoId: 'A',
            chunkId: 'meta',
            text: videoA.transcriptPreview || videoA.description,
            startTimeSeconds: 0,
            endTimeSeconds: 0,
            sourceUrl: videoA.sourceUrl,
            metadata: { title: videoA.title, creator: videoA.creator }
          });
        }

        if (videoB) {
          metaCites.push({
            videoId: 'B',
            chunkId: 'meta',
            text: videoB.transcriptPreview || videoB.description,
            startTimeSeconds: 0,
            endTimeSeconds: 0,
            sourceUrl: videoB.sourceUrl,
            metadata: { title: videoB.title, creator: videoB.creator }
          });
        }

        return metaCites;
      })();

  return {
    retrievedChunks: retrievedChunks as RetrievedChunk[],
    transcriptEvidence,
    citations
  };
}

function isFirstFiveSecondsQuestion(question: string) {
  return /(first\s*5|5\s*sec|5\s*seconds|hook)/i.test(question);
}

function normalizeGeneratedTitle(title: string) {
  return title
    .replace(/["'`]/g, '')
    .replace(/[\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function fallbackGeneratedTitle(question: string) {
  const words = question
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 5);

  return words.length ? words.join(' ') : 'New chat';
}

function buildConversationTranscript(history: PromptTurn[]) {
  if (!history.length) {
    return 'No prior turns.';
  }

  return history.map((turn) => `${turn.role}: ${turn.content}`).join('\n');
}

async function buildPrompt(state: RagState, registry: VideoRegistry) {
  const videoA = state.context?.videoA ?? registry.get('A');
  const videoB = state.context?.videoB ?? registry.get('B');
  const retrievedSummary = state.retrievedChunks
    .map((chunk) => `- [${chunk.videoId}:${chunk.chunkId}] ${chunk.text}`)
    .join('\n');

  const allowMetadataFallback = !retrievedSummary;

  return [
    'You are a concise creator analytics assistant for a social video RAG app.',
    allowMetadataFallback
      ? 'No transcript chunks were retrieved for these videos. You may use structured video metadata and descriptions to answer the user. Be explicit when a transcript is unavailable and avoid inventing verbatim spoken text.'
      : 'Answer using evidence from the provided transcript chunks and video metadata where applicable.',
    'Cite factual claims when they come from transcript chunks using the format [video_id:chunk_id].',
    'If you rely on structured metadata (views/likes/comments/creator/description), you may cite it with [video_id:meta].',
    '',
    `Conversation history:\n${buildConversationTranscript(state.conversationHistory)}`,
    '',
    `Video A metadata: ${videoA ? JSON.stringify(videoA) : 'not ingested yet'}`,
    `Video B metadata: ${videoB ? JSON.stringify(videoB) : 'not ingested yet'}`,
    '',
    `Retrieved transcript chunks:\n${retrievedSummary || 'No transcript chunks retrieved.'}`,
    '',
    `User question: ${state.question}`,
    '',
    'Required output: a direct answer, then a short bullet list of citations. If no transcript evidence exists, use metadata and mark transcript as unavailable.'
  ].join('\n');
}

async function persistExistingHistory(
  dependencies: RagDependencies,
  conversationId: string,
  history: PromptTurn[],
  options: {
    clerkUserId: string;
    title?: string;
    context?: ConversationVideoContext;
  }
) {
  for (const [index, turn] of history.entries()) {
    await dependencies.conversationStore.appendTurn(
      conversationId,
      {
        role: turn.role,
        content: turn.content,
        timestamp: new Date().toISOString()
      },
      {
        clerkUserId: options.clerkUserId,
        title: index === 0 ? options.title : undefined,
        context: index === 0 ? options.context ?? undefined : undefined
      }
    );
  }
}

export function createRagEngine(dependencies: RagDependencies) {
  const llm = new GeminiLlm();

  const generateConversationTitle = async (question: string) => {
    try {
      const generated = await llm.generate(
        [
          'Generate a short chat title for a conversation about comparing two social videos.',
          'Use 4 to 5 words only.',
          'Do not use quotes, punctuation, or numbering.',
          'Return title only.',
          '',
          `User question: ${question}`
        ].join('\n')
      );

      const normalized = normalizeGeneratedTitle(generated);
      if (!normalized) {
        return fallbackGeneratedTitle(question);
      }

      const words = normalized.split(' ').filter(Boolean).slice(0, 5);
      return words.join(' ') || fallbackGeneratedTitle(question);
    } catch {
      return fallbackGeneratedTitle(question);
    }
  };

  const graph = new StateGraph(RagAnnotation as never)
    .addNode('retrieve', async (state: RagState) => {
      const queryEmbedding = await dependencies.embeddings.embedQuery(state.question);
      const firstFiveQuestion = isFirstFiveSecondsQuestion(state.question);
      const relevantChunks = await dependencies.vectorStore.search(queryEmbedding, {
        videoId: state.videoIds.length === 1 ? state.videoIds[0] : undefined,
        topK: firstFiveQuestion ? 20 : 6
      });

      const filteredChunks = firstFiveQuestion
        ? relevantChunks
          .filter((chunk) => chunk.startTimeSeconds <= 8)
          .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
          .slice(0, 8)
        : relevantChunks;

      return {
        retrievedChunks: filteredChunks as RetrievedChunk[]
      };
    })
    .addNode('collect-evidence', async (state: RagState) => {
      const transcriptEvidence = await collectTranscriptEvidence(state.videoIds, dependencies.vectorStore);

      return {
        transcriptEvidence
      };
    })
    .addNode('generate', async (state: RagState) => {
      const prompt = await buildPrompt(state, dependencies.videoRegistry);
      const answer = await llm.generate(prompt);

      if (state.persist && state.clerkUserId) {
        await dependencies.conversationStore.appendTurn(
          state.conversationId,
          {
            role: 'assistant',
            content: answer,
            timestamp: new Date().toISOString()
          },
          {
            clerkUserId: state.clerkUserId,
            citations: formatCitations(state.retrievedChunks),
            transcriptEvidence: state.transcriptEvidence
          }
        );
      }

      const citations = state.retrievedChunks.length
        ? formatCitations(state.retrievedChunks)
        : ((): RagState['citations'] => {
            const metaCites: Citation[] = [];
            const videoA = state.context?.videoA ?? dependencies.videoRegistry.get('A');
            const videoB = state.context?.videoB ?? dependencies.videoRegistry.get('B');

            if (videoA) {
              metaCites.push({
                videoId: 'A',
                chunkId: 'meta',
                text: videoA.transcriptPreview || videoA.description,
                startTimeSeconds: 0,
                endTimeSeconds: 0,
                sourceUrl: videoA.sourceUrl,
                metadata: { title: videoA.title, creator: videoA.creator }
              });
            }

            if (videoB) {
              metaCites.push({
                videoId: 'B',
                chunkId: 'meta',
                text: videoB.transcriptPreview || videoB.description,
                startTimeSeconds: 0,
                endTimeSeconds: 0,
                sourceUrl: videoB.sourceUrl,
                metadata: { title: videoB.title, creator: videoB.creator }
              });
            }

            return metaCites;
          })();

      return {
        answer,
        citations,
        transcriptEvidence: state.transcriptEvidence
      };
    })
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'collect-evidence')
    .addEdge('collect-evidence', 'generate')
    .addEdge('generate', END)
    .compile();

  const answerQuestion = async (question: string, input?: AnswerInput) => {
    const persist = Boolean(input?.persist && input.clerkUserId);
    const conversationId = input?.conversationId ?? `${persist ? 'conv' : 'guest'}_${Date.now()}`;
    const title = input?.conversationId ? undefined : await generateConversationTitle(question);
    const baseHistory = input?.history ?? input?.conversationHistory ?? [];

    const resolvedContext = input?.context
      ?? (persist && input?.conversationId && input.clerkUserId
        ? await dependencies.conversationStore.getActiveContext(input.conversationId, input.clerkUserId)
        : null);

    if (persist && input?.clerkUserId && !input?.conversationId && baseHistory.length) {
      await persistExistingHistory(dependencies, conversationId, baseHistory, {
        clerkUserId: input.clerkUserId,
        title,
        context: input?.context ?? undefined
      });
    }

    if (persist && input?.clerkUserId) {
      await dependencies.conversationStore.appendTurn(
        conversationId,
        {
          role: 'user',
          content: question,
          timestamp: new Date().toISOString()
        },
        {
          clerkUserId: input.clerkUserId,
          title: baseHistory.length ? undefined : title,
          context: !baseHistory.length ? input?.context ?? undefined : undefined
        }
      );
    }

    const conversationHistory = [...baseHistory, { role: 'user' as const, content: question }];
    const result = await graph.invoke({
      clerkUserId: input?.clerkUserId ?? null,
      persist,
      conversationId,
      question,
      videoIds: input?.videoIds ?? ['A', 'B'],
      context: resolvedContext,
      conversationHistory,
      retrievedChunks: [],
      transcriptEvidence: [],
      answer: '',
      citations: []
    } as RagState);

    return {
      conversationId,
      answer: result.answer,
      citations: result.citations,
      transcriptEvidence: result.transcriptEvidence,
      retrievedChunks: result.retrievedChunks
    };
  };

  return {
    answer: answerQuestion,
    inspectEvidence: async (question: string, input?: Partial<Pick<RagState, 'videoIds' | 'context'>>) =>
      inspectQuestionEvidence(question, dependencies, input),
    async *streamAnswer(question: string, input?: AnswerInput) {
      const response = await answerQuestion(question, input);
      const tokens = response.answer.match(/.{1,80}/g) ?? [response.answer];

      for (const token of tokens) {
        yield { type: 'token' as const, token };
      }

      yield {
        type: 'final' as const,
        response
      };
    }
  };
}
