import type { FastifyPluginAsync } from 'fastify';

import { videosController } from './videos.controller.js';

export const videoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:videoId', videosController);
};
