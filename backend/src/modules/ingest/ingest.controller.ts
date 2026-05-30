import type { FastifyReply, FastifyRequest } from 'fastify';

import { ingestRequestSchema } from './ingest.schemas.js';
import { createIngestJob } from './ingest.service.js';

export async function ingestController(request: FastifyRequest, reply: FastifyReply) {
  const payload = ingestRequestSchema.parse(request.body);
  const job = await createIngestJob(payload);

  return reply.code(200).send({
    message: 'Ingestion complete',
    data: job
  });
}
