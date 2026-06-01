import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { clerkPlugin } from '@clerk/fastify';

import { env } from './config/env.js';
import { loggerOptions } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { registerRoutes } from './routes/index.js';

export function createApp() {
  const app = Fastify({
    logger: loggerOptions
  });

  app.register(sensible);
  app.register(helmet);
  const origins = (env.FRONTEND_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        origins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin === 'http://localhost:5173' ||
        origin === 'http://localhost:3000'
      ) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH']
  });
  app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute'
  });
  if (env.CLERK_SECRET_KEY) {
    app.register(clerkPlugin, {
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY
    });
  }

  app.register(registerRoutes, { prefix: '/api/v1' });
  app.setNotFoundHandler(notFoundHandler);
  app.setErrorHandler(errorHandler);

  return app;
}
