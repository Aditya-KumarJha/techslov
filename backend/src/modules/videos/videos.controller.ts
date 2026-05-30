import type { FastifyReply, FastifyRequest } from 'fastify';

import { getVideoMetadata } from './videos.service.js';

export async function videosController(
  request: FastifyRequest<{ Params: { videoId: 'A' | 'B' } }>,
  reply: FastifyReply
) {
  const metadata = await getVideoMetadata(request.params.videoId);

  if (!metadata) {
    return reply.code(404).send({
      message: `Video ${request.params.videoId} has not been ingested yet.`
    });
  }

  return reply.send({
    message: 'Video metadata fetched',
    data: metadata
  });
}
