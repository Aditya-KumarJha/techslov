import type { FastifyPluginAsync } from 'fastify';

import { chatRoutes } from '../modules/chat/chat.routes.js';
import { historyRoutes } from '../modules/history/history.routes.js';
import { healthRoutes } from '../modules/health/health.routes.js';
import { ingestRoutes } from '../modules/ingest/ingest.routes.js';
import { videoRoutes } from '../modules/videos/videos.routes.js';

export const registerRoutes: FastifyPluginAsync = async (app) => {
  app.register(healthRoutes, { prefix: '/health' });
  app.register(ingestRoutes, { prefix: '/ingest' });
  app.register(historyRoutes, { prefix: '/history' });
  app.register(videoRoutes, { prefix: '/videos' });
  app.register(chatRoutes, { prefix: '/chat' });
};
