// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from './config/env';
import { apiRouter } from './routes';
import { authRouter } from './routes/auth';
import { errorHandler } from './middlewares/errorHandler';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // allowlist из ENV (через запятую)
  const allowlist = (env.CORS_ORIGIN ?? 'https://crm.vroo.it.com')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const corsOptions: cors.CorsOptions = {
    origin(origin, cb) {
      // Разрешаем запросы без Origin (curl, healthchecks) и из allowlist
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 204,
  };

  // ВАЖНО: только один cors() глобально — этого достаточно и для preflight
  app.use(cors(corsOptions));

  // Бонус: дублируем ACAO/ACC на всякий случай (вариация по Origin)
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && allowlist.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    next();
  });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  // Роуты
  app.use('/auth', authRouter);
  app.use('/', apiRouter);

  // 404 и обработчик ошибок
  app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
  app.use(errorHandler);

  return app;
}