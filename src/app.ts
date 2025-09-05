import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import os from 'os';

import { env, corsAllowlist } from './config/env';
import { apiRouter } from './routes';
import { authRouter } from './routes/auth';    
import { errorHandler } from './middlewares/errorHandler';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet({
    crossOriginResourcePolicy: false, 
  }));
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || corsAllowlist.includes(origin)) return cb(null, true);
      return cb(null, true); 
    },
    credentials: true,
  }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());

  app.use('/api', apiRouter);
  app.use('/api', authRouter);

  app.get('/__whoami', (_req, res) => {
    res.json({ host: os.hostname(), pid: process.pid, startedAt: new Date().toISOString() });
  });
  app.get('/api/__whoami', (_req, res) => {
    res.json({ host: os.hostname(), pid: process.pid, startedAt: new Date().toISOString() });
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

  app.use(errorHandler);

  return app;
}