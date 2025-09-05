import { createApp } from './app';
import { env } from './config/env';
import { connectDB } from './db';
import { startScheduler, agenda } from './scheduler';

async function bootstrap() {
  await connectDB();

  await startScheduler();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[HTTP] listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (reason: string) => {
    console.log(`[SHUTDOWN] ${reason}`);
    try {
      if (agenda) await agenda.stop();
    } catch {}
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err);
    shutdown('unhandledRejection');
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});