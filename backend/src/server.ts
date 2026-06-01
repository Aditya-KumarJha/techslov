import 'dotenv/config';

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

    app.log.info('db connected');
    app.log.info('backend ready');
  } catch (error) {
    app.log.error(error, 'Failed to start backend');
    process.exit(1);
  }
}

void bootstrap();
