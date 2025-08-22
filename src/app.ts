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

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      optionsSuccessStatus: 204,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.use('/auth', authRouter);
  app.use('/', apiRouter); 

  app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
  app.use(errorHandler);

  return app;
}