import type { FastifyPluginAsync } from 'fastify';

import { chatController, chatStreamController } from './chat.controller.js';

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', chatController);
  app.post('/stream', chatStreamController);
};
