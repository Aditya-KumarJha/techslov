import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  getConversationHistory,
  getJobHistory,
  listConversationHistory,
  listJobHistory,
  saveConversationContext,
  removeConversation,
  renameConversation,
  setConversationContextIndex
} from './history.service.js';
import { z } from 'zod';

import type { ConversationVideoContext, UpdateConversationContextIndexRequest, UpdateConversationTitleRequest } from '../../types/api.js';
import { getRequestUserId } from '../../lib/auth/auth.js';

function requireUserId(request: FastifyRequest, reply: FastifyReply) {
  const clerkUserId = getRequestUserId(request);

  if (!clerkUserId) {
    void reply.code(401).send({ message: 'Authentication required' });
    return null;
  }

  return clerkUserId;
}

export async function listConversationsController(request: FastifyRequest, reply: FastifyReply) {
  const conversations = await listConversationHistory(getRequestUserId(request));
  return reply.send({ data: conversations });
}

export async function listJobsController(_request: FastifyRequest, reply: FastifyReply) {
  const jobs = await listJobHistory();
  return reply.send({ data: jobs });
}

export async function getJobController(
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply
) {
  const job = await getJobHistory(request.params.jobId);

  if (!job) {
    return reply.code(404).send({ message: 'Job history not found' });
  }

  return reply.send({ data: job });
}

export async function getConversationController(
  request: FastifyRequest<{ Params: { conversationId: string } }>,
  reply: FastifyReply
) {
  const conversation = await getConversationHistory(request.params.conversationId, getRequestUserId(request));

  if (!conversation) {
    return reply.code(404).send({ message: 'Conversation history not found' });
  }

  return reply.send({ data: conversation });
}

const updateConversationTitleSchema = z.object({
  title: z.string().min(1)
});

const updateConversationContextIndexSchema = z.object({
  activeContextIndex: z.number().int().min(0)
});

const conversationVideoContextSchema = z.object({
  contextId: z.string(),
  createdAt: z.string(),
  videoA: z.any(),
  videoB: z.any()
});

export async function updateConversationTitleController(
  request: FastifyRequest<{ Params: { conversationId: string }; Body: UpdateConversationTitleRequest }>,
  reply: FastifyReply
) {
  const clerkUserId = requireUserId(request, reply);

  if (!clerkUserId) {
    return reply;
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  const payload = updateConversationTitleSchema.parse(body);
  const title = await renameConversation(request.params.conversationId, clerkUserId, payload.title);

  if (!title) {
    return reply.code(404).send({ message: 'Conversation history not found' });
  }

  return reply.send({ data: { conversationId: request.params.conversationId, title } });
}

export async function deleteConversationController(
  request: FastifyRequest<{ Params: { conversationId: string } }>,
  reply: FastifyReply
) {
  const clerkUserId = requireUserId(request, reply);

  if (!clerkUserId) {
    return reply;
  }

  const deleted = await removeConversation(request.params.conversationId, clerkUserId);

  if (!deleted) {
    return reply.code(404).send({ message: 'Conversation history not found' });
  }

  return reply.code(204).send();
}

export async function updateConversationContextIndexController(
  request: FastifyRequest<{ Params: { conversationId: string }; Body: UpdateConversationContextIndexRequest }>,
  reply: FastifyReply
) {
  const clerkUserId = requireUserId(request, reply);

  if (!clerkUserId) {
    request.log.warn({ conversationId: request.params.conversationId }, 'updateConversationContextIndexController - Auth failed');
    return reply;
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  const payload = updateConversationContextIndexSchema.parse(body);
  request.log.info({
    conversationId: request.params.conversationId,
    clerkUserId,
    activeContextIndex: payload.activeContextIndex
  }, 'updateConversationContextIndexController - Attempting update');

  const updated = await setConversationContextIndex(request.params.conversationId, clerkUserId, payload.activeContextIndex);

  if (!updated) {
    request.log.error({
      conversationId: request.params.conversationId,
      clerkUserId,
      activeContextIndex: payload.activeContextIndex
    }, 'updateConversationContextIndexController - Update failed (404)');
    return reply.code(404).send({ message: 'Conversation history not found' });
  }

  request.log.info({
    conversationId: request.params.conversationId,
    clerkUserId,
    activeContextIndex: payload.activeContextIndex
  }, 'updateConversationContextIndexController - Update succeeded');

  return reply.send({ data: { conversationId: request.params.conversationId, activeContextIndex: payload.activeContextIndex } });
}

export async function addConversationContextController(
  request: FastifyRequest<{ Params: { conversationId: string }; Body: ConversationVideoContext }>,
  reply: FastifyReply
) {
  const clerkUserId = requireUserId(request, reply);

  if (!clerkUserId) {
    return reply;
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  const payload = conversationVideoContextSchema.parse(body) as ConversationVideoContext;
  await saveConversationContext(request.params.conversationId, clerkUserId, payload);
  return reply.code(201).send({ data: payload });
}
