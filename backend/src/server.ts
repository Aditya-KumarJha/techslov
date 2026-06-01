import 'dotenv/config';
import path from 'node:path';

// Prepend ./bin to PATH so yt-dlp and other child processes can discover ffmpeg and local binaries
process.env.PATH = `${process.env.PATH}:${path.resolve(process.cwd(), 'bin')}`;

import { createApp } from './app.js';
import { env } from './config/env.js';
import { initializeAppContainer } from './lib/runtime/app-container.js';

async function bootstrap() {
  await initializeAppContainer();

  const app = createApp();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });

    app.log.info(`frontend origin: ${env.FRONTEND_ORIGIN}`);
    app.log.info('db connected');
    if (env.DATABASE_URL) {
      const hasSslMode = /sslmode=/.test(env.DATABASE_URL);
      app.log.info(`database sslmode present: ${hasSslMode}`);
    }
    app.log.info('backend ready');
  } catch (error) {
    app.log.error(error, 'Failed to start backend');
    process.exit(1);
  }
}

void bootstrap();
