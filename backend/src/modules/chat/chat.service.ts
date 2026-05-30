import { getAppContainer } from '../../lib/runtime/app-container.js';
import type { ChatMessage } from './chat.schemas.js';

export async function prepareChatContext(message: ChatMessage) {
  const container = getAppContainer();
  const conversationId = message.conversationId ?? `conv_${Date.now()}`;
  const answer = await container.ragEngine.answer(message.message, {
    conversationId,
    videoIds: message.videoIds ?? ['A', 'B'],
    context: message.videoContext
  });

  return {
    ...answer,
    conversationId
  };
}
