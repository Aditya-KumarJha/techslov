import { getAppContainer } from '../../lib/runtime/app-container.js';
import type { ConversationVideoContext } from '../../types/api.js';

export async function listJobHistory() {
  return getAppContainer().jobHistoryStore.list();
}

export async function getJobHistory(jobId: string) {
  return getAppContainer().jobHistoryStore.get(jobId);
}

export async function listConversationHistory() {
  return getAppContainer().conversationStore.listConversations();
}

export async function getConversationHistory(conversationId: string) {
  return getAppContainer().conversationStore.getConversationThread(conversationId);
}

export async function renameConversation(conversationId: string, title: string) {
  return getAppContainer().conversationStore.updateConversationTitle(conversationId, title);
}

export async function removeConversation(conversationId: string) {
  return getAppContainer().conversationStore.deleteConversation(conversationId);
}

export async function setConversationContextIndex(conversationId: string, activeContextIndex: number) {
  return getAppContainer().conversationStore.updateActiveContextIndex(conversationId, activeContextIndex);
}

export async function saveConversationContext(conversationId: string, context: ConversationVideoContext) {
  return getAppContainer().conversationStore.upsertConversationContext(conversationId, context);
}
