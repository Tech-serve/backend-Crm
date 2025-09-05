import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080), 
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('https://crm.vroo.it.com'),
  JWT_SECRET: z.string().default('change-me'),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  APP_TZ: z.string().default('Europe/Kyiv'),
});

export const env = envSchema.parse(process.env);

export const corsAllowlist = env.CORS_ORIGIN.split(',')
  .map(s => s.trim())
  .filter(Boolean);