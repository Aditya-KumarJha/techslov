import type { FastifyReply, FastifyRequest } from 'fastify';

import { getConversationHistory, getJobHistory, listJobHistory } from './history.service.js';

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
  return reply.send({ data: conversation });
}
