import type { FastifyPluginAsync } from 'fastify';

import {
  getConversationController,
  getJobController,
  listJobsController
} from './history.controller.js';

export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/jobs', listJobsController);
  app.get('/jobs/:jobId', getJobController);
  app.get('/conversations/:conversationId', getConversationController);
};
