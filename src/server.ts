import { createApp } from './app';
import { env } from './config/env';
import { connectDB } from './db';

async function bootstrap() {
  await connectDB();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[HTTP] listening on :${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});