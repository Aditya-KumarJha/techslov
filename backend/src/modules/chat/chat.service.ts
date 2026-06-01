import { getAppContainer } from '../../lib/runtime/app-container.js';
import type { ChatMessage } from './chat.schemas.js';

export async function prepareChatContext(
  message: ChatMessage,
  options?: {
    clerkUserId?: string | null;
    persist?: boolean;
  }
) {
  const container = getAppContainer();
  const answer = await container.ragEngine.answer(message.message, {
    clerkUserId: options?.clerkUserId ?? null,
    persist: options?.persist ?? false,
    conversationId: message.conversationId,
    videoIds: message.videoIds ?? ['A', 'B'],
    context: message.videoContext,
    history: message.history ?? []
  });

  return answer;
}
