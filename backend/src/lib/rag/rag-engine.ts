import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { EmbeddingsProvider } from '../embeddings/embeddings-provider.js';
import { GeminiLlm } from '../llm/gemini-llm.js';
import type { ConversationStore } from '../state/conversation-store.js';
import type { VideoRegistry } from '../state/video-registry.js';
import type { VectorStoreAdapter } from '../vector-store/vector-store.js';
import type { VideoId, Citation } from '../../types/api.js';

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

async function buildPrompt(
  state: RagState,
  registry: VideoRegistry,
  conversationStore: ConversationStore
) {
  const videoA = registry.get('A');
  const videoB = registry.get('B');
  const conversationHistory = state.conversationId
    ? await conversationStore.getConversation(state.conversationId)
    : [];
  const retrievedSummary = state.retrievedChunks
    .map((chunk) => `- [${chunk.videoId}:${chunk.chunkId}] ${chunk.text}`)
    .join('\n');

  return [
    'You are a concise creator analytics assistant for a social video RAG app.',
    'Answer only with evidence from the provided video data and retrieved transcript chunks.',
    'Cite every factual claim using the format [video_id:chunk_id].',
    'If a metric or creator detail is available in the structured video metadata, use it directly.',
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
    'Required output: a direct answer, then a short bullet list of citations.'
  ].join('\n');
}

export function createRagEngine(dependencies: RagDependencies) {
  const llm = new GeminiLlm();

  const answerQuestion = async (question: string, input?: Partial<Pick<RagState, 'conversationId' | 'videoIds'>>) => {
    const conversationId = input?.conversationId ?? `conv_${Date.now()}`;

    await dependencies.conversationStore.appendTurn(conversationId, {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    });

    const result = await graph.invoke({
      conversationId,
      question,
      videoIds: input?.videoIds ?? ['A', 'B'],
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
      const relevantChunks = await dependencies.vectorStore.search(queryEmbedding, {
        videoId: state.videoIds.length === 1 ? state.videoIds[0] : undefined,
        topK: 6
      });

      return {
        retrievedChunks: relevantChunks as RetrievedChunk[]
      };
    })
    .addNode('generate', async (state: RagState) => {
      const answer = await llm.generate(
        await buildPrompt(state, dependencies.videoRegistry, dependencies.conversationStore)
      );

      await dependencies.conversationStore.appendTurn(state.conversationId, {
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString()
      });

      return {
        answer,
        citations: formatCitations(state.retrievedChunks)
      };
    })
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END)
    .compile();

  return {
    answer: answerQuestion,
    async *streamAnswer(question: string, input?: Partial<Pick<RagState, 'conversationId' | 'videoIds'>>) {
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
