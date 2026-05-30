import type { FastifyPluginAsync } from 'fastify';

import { ingestController } from './ingest.controller.js';

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', ingestController);
};
