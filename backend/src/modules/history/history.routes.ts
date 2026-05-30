import type { FastifyPluginAsync } from 'fastify';

import {
  addConversationContextController,
  deleteConversationController,
  listConversationsController,
  getConversationController,
  getJobController,
  listJobsController,
  updateConversationContextIndexController,
  updateConversationTitleController
} from './history.controller.js';

export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/jobs', listJobsController);
  app.get('/jobs/:jobId', getJobController);
  app.get('/conversations', listConversationsController);
  app.get('/conversations/:conversationId', getConversationController);
  app.patch('/conversations/:conversationId', updateConversationTitleController);
  app.delete('/conversations/:conversationId', deleteConversationController);
  app.post('/conversations/:conversationId/contexts', addConversationContextController);
  app.patch('/conversations/:conversationId/context-index', updateConversationContextIndexController);
};
