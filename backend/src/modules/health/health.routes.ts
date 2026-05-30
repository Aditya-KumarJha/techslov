import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({
    status: 'ok',
    service: env.APP_NAME,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }));
};
