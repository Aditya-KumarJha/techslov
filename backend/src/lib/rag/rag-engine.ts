import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { EmbeddingsProvider } from '../embeddings/embeddings-provider.js';
import { GeminiLlm } from '../llm/gemini-llm.js';
import type { ConversationStore } from '../state/conversation-store.js';
import type { VideoRegistry } from '../state/video-registry.js';
import type { VectorStoreAdapter } from '../vector-store/vector-store.js';
import type { Citation, ConversationVideoContext, VideoId } from '../../types/api.js';

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

type RagState = {
  conversationId: string;
  question: string;
  videoIds: VideoId[];
  context: ConversationVideoContext | null;
  retrievedChunks: RetrievedChunk[];
  answer: string;
  citations: Citation[];
};

export type RagDependencies = {
  embeddings: EmbeddingsProvider;
  vectorStore: VectorStoreAdapter;
  conversationStore: ConversationStore;
  videoRegistry: VideoRegistry;
};

const RagAnnotation = Annotation.Root({
  conversationId: Annotation<string>(),
  question: Annotation<string>(),
  videoIds: Annotation<VideoId[]>(),
  context: Annotation<ConversationVideoContext | null>(),
  retrievedChunks: Annotation<RetrievedChunk[]>(),
  answer: Annotation<string>(),
  citations: Annotation<Citation[]>()
});

function formatCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    videoId: chunk.videoId,
    chunkId: chunk.chunkId,
    startTimeSeconds: chunk.startTimeSeconds,
    endTimeSeconds: chunk.endTimeSeconds
  }));
}

function isFirstFiveSecondsQuestion(question: string) {
  return /(first\s*5|5\s*sec|5\s*seconds|hook)/i.test(question);
}

function deriveConversationTitle(question: string) {
  const cleaned = question.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= 64) {
    return cleaned;
  }

  return `${cleaned.slice(0, 61).trimEnd()}...`;
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

async function buildPrompt(
  state: RagState,
  registry: VideoRegistry,
  conversationStore: ConversationStore
) {
  const videoA = state.context?.videoA ?? registry.get('A');
  const videoB = state.context?.videoB ?? registry.get('B');
  const conversationHistory = state.conversationId
    ? await conversationStore.getConversation(state.conversationId)
    : [];
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
      "If you rely on structured metadata (views/likes/comments/creator/description), you may cite it with [video_id:meta].",
      '',
      `Conversation history:\n${conversationHistory.length ? conversationHistory.map((turn) => `${turn.role}: ${turn.content}`).join('\n') : 'No prior turns.'}`,
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

  const answerQuestion = async (
    question: string,
    input?: Partial<Pick<RagState, 'conversationId' | 'videoIds' | 'context'>>
  ) => {
    const conversationId = input?.conversationId ?? `conv_${Date.now()}`;
    const title = input?.conversationId ? undefined : await generateConversationTitle(question);
    const resolvedContext = input?.context ?? (input?.conversationId ? await dependencies.conversationStore.getActiveContext(input.conversationId) : null);

    await dependencies.conversationStore.appendTurn(conversationId, {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    }, {
      title,
      context: input?.context ?? undefined
    });

    const result = await graph.invoke({
      conversationId,
      question,
      videoIds: input?.videoIds ?? ['A', 'B'],
      context: resolvedContext,
      retrievedChunks: [],
      answer: '',
      citations: []
    } as RagState);

    return {
      conversationId,
      answer: result.answer,
      citations: result.citations,
      retrievedChunks: result.retrievedChunks
    };
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
    .addNode('generate', async (state: RagState) => {
      const prompt = await buildPrompt(state, dependencies.videoRegistry, dependencies.conversationStore);
      const answer = await llm.generate(prompt);

      await dependencies.conversationStore.appendTurn(state.conversationId, {
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString()
      });

      // If retrieved transcript chunks are empty, synthesize metadata citations
      const citations = state.retrievedChunks.length
        ? formatCitations(state.retrievedChunks)
        : ((): RagState['citations'] => {
            const metaCites: Citation[] = [];
            const videoA = state.context?.videoA ?? dependencies.videoRegistry.get('A');
            const videoB = state.context?.videoB ?? dependencies.videoRegistry.get('B');

            if (videoA) {
              metaCites.push({ videoId: 'A', chunkId: 'meta', startTimeSeconds: 0, endTimeSeconds: 0 });
            }

            if (videoB) {
              metaCites.push({ videoId: 'B', chunkId: 'meta', startTimeSeconds: 0, endTimeSeconds: 0 });
            }

            return metaCites;
          })();

      return {
        answer,
        citations
      };
    })
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END)
    .compile();

  return {
    answer: answerQuestion,
    async *streamAnswer(question: string, input?: Partial<Pick<RagState, 'conversationId' | 'videoIds' | 'context'>>) {
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
