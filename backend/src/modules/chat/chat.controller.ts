import type { FastifyReply, FastifyRequest } from 'fastify';

import { chatMessageSchema } from './chat.schemas.js';
import { prepareChatContext } from './chat.service.js';
import { getAppContainer } from '../../lib/runtime/app-container.js';
import { startSseStream, writeSseEvent } from '../../lib/http/sse.js';
import { getAuthenticatedUser, getRequestUserId } from '../../lib/auth/auth.js';

type ChatRequest = FastifyRequest<{ Body: unknown }>;

export async function chatController(request: ChatRequest, reply: FastifyReply) {
  const payload = chatMessageSchema.parse(request.body);
  const user = await getAuthenticatedUser(request);

  if (user) {
    await getAppContainer().userStore.upsertUser(user);
  }

  const context = await prepareChatContext(payload, {
    clerkUserId: user?.clerkUserId ?? null,
    persist: Boolean(user?.clerkUserId)
  });

  return reply.send({
    message: 'Chat response generated',
    data: context
  });
}

export async function chatStreamController(request: ChatRequest, reply: FastifyReply) {
  try {
    const payload = chatMessageSchema.parse(request.body);
    const container = getAppContainer();
    const user = await getAuthenticatedUser(request);

    if (user) {
      await container.userStore.upsertUser(user);
    }

    startSseStream(reply);

    for await (const event of container.ragEngine.streamAnswer(payload.message, {
      clerkUserId: getRequestUserId(request),
      persist: Boolean(user?.clerkUserId),
      conversationId: payload.conversationId,
      videoIds: payload.videoIds,
      context: payload.videoContext,
      history: payload.history
    })) {
      if (event.type === 'token') {
        writeSseEvent(reply, 'token', { token: event.token });
      } else {
        writeSseEvent(reply, 'final', event.response);
      }
    }

    reply.raw.end();
    return reply;
  } catch (error) {
    request.log.error({ err: error }, 'Chat stream failed');

    if (reply.raw.headersSent) {
      writeSseEvent(reply, 'error', {
        message: error instanceof Error ? error.message : 'Chat stream failed'
      });
      reply.raw.end();
      return reply;
    }

    return reply.code(500).send({
      message: error instanceof Error ? error.message : 'Chat stream failed'
    });
  }
}
