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

  const allowlist = (env.CORS_ORIGIN ?? 'https://crm.vroo.it.com')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const corsOptions: cors.CorsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.use('/auth', authRouter);
  app.use('/', apiRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
  app.use(errorHandler);

  return app;
}