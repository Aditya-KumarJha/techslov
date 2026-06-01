import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply) {
  reply.code(404).send({
    error: 'Not Found',
    message: 'The requested route does not exist'
  });
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({ err: error }, 'Unhandled request error');

  const statusCode = error.statusCode ?? 500;
  const message =
    statusCode >= 500
      ? `${error.message || 'Internal Server Error'}`
      : error.message || 'Request failed';

  reply.code(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : error.name,
    message
  });
}
