import { getAppContainer } from '../../lib/runtime/app-container.js';

export async function listJobHistory() {
  return getAppContainer().jobHistoryStore.list();
}

export async function getJobHistory(jobId: string) {
  return getAppContainer().jobHistoryStore.get(jobId);
}

export async function getConversationHistory(conversationId: string) {
  return getAppContainer().conversationStore.getConversation(conversationId);
}
