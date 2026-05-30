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

export async function listConversationsController(_request: FastifyRequest, reply: FastifyReply) {
  const conversations = await listConversationHistory();
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
  const conversation = await getConversationHistory(request.params.conversationId);

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
  const payload = updateConversationTitleSchema.parse(request.body);
  const title = await renameConversation(request.params.conversationId, payload.title);

  return reply.send({ data: { conversationId: request.params.conversationId, title } });
}

export async function deleteConversationController(
  request: FastifyRequest<{ Params: { conversationId: string } }>,
  reply: FastifyReply
) {
  await removeConversation(request.params.conversationId);
  return reply.code(204).send();
}

export async function updateConversationContextIndexController(
  request: FastifyRequest<{ Params: { conversationId: string }; Body: UpdateConversationContextIndexRequest }>,
  reply: FastifyReply
) {
  const payload = updateConversationContextIndexSchema.parse(request.body);
  await setConversationContextIndex(request.params.conversationId, payload.activeContextIndex);
  return reply.send({ data: { conversationId: request.params.conversationId, activeContextIndex: payload.activeContextIndex } });
}

export async function addConversationContextController(
  request: FastifyRequest<{ Params: { conversationId: string }; Body: ConversationVideoContext }>,
  reply: FastifyReply
) {
  const payload = conversationVideoContextSchema.parse(request.body) as ConversationVideoContext;
  await saveConversationContext(request.params.conversationId, payload);
  return reply.code(201).send({ data: payload });
}
