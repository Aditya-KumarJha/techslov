import { getAppContainer } from '../../lib/runtime/app-container.js';
import type { ConversationVideoContext } from '../../types/api.js';

async function hydrateConversationThreadEvidence() {
  const container = getAppContainer();
  return container;
}

export async function enrichConversationThread(conversationId: string, clerkUserId: string | null) {
  const container = await hydrateConversationThreadEvidence();
  const thread = await container.conversationStore.getConversationThread(conversationId, clerkUserId);

  if (!thread) {
    return null;
  }

  const activeContext = thread.contexts[thread.activeContextIndex] ?? thread.contexts[0] ?? null;
  const turns = [...thread.turns];

  let latestUserQuestion: string | null = null;

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];

    if (turn.role === 'user') {
      latestUserQuestion = turn.content;
      continue;
    }

    if (turn.citations?.length && turn.transcriptEvidence?.length) {
      continue;
    }

    if (!latestUserQuestion) {
      continue;
    }

    const evidence = await container.ragEngine.inspectEvidence(latestUserQuestion, {
      context: activeContext ?? undefined,
      videoIds: ['A', 'B']
    });

    turns[index] = {
      ...turn,
      citations: turn.citations?.length ? turn.citations : evidence.citations,
      transcriptEvidence: turn.transcriptEvidence?.length ? turn.transcriptEvidence : evidence.transcriptEvidence
    };
  }

  return {
    ...thread,
    turns
  };
}

export async function listJobHistory() {
  return getAppContainer().jobHistoryStore.list();
}

export async function getJobHistory(jobId: string) {
  return getAppContainer().jobHistoryStore.get(jobId);
}

export async function listConversationHistory(clerkUserId: string | null) {
  return getAppContainer().conversationStore.listConversations(clerkUserId);
}

export async function getConversationHistory(conversationId: string, clerkUserId: string | null) {
  return enrichConversationThread(conversationId, clerkUserId);
}

export async function renameConversation(conversationId: string, clerkUserId: string, title: string) {
  return getAppContainer().conversationStore.updateConversationTitle(conversationId, clerkUserId, title);
}

export async function removeConversation(conversationId: string, clerkUserId: string) {
  return getAppContainer().conversationStore.deleteConversation(conversationId, clerkUserId);
}

export async function setConversationContextIndex(conversationId: string, clerkUserId: string, activeContextIndex: number) {
  return getAppContainer().conversationStore.updateActiveContextIndex(conversationId, clerkUserId, activeContextIndex);
}

export async function saveConversationContext(conversationId: string, clerkUserId: string, context: ConversationVideoContext) {
  return getAppContainer().conversationStore.upsertConversationContext(conversationId, clerkUserId, context);
}
