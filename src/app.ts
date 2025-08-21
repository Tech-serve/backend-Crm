import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { apiRouter } from './routes';
import { authRouter } from './routes/auth';
import { errorHandler } from './middlewares/errorHandler';
import { candidatesRouter } from './routes/candidates.routes';
import { employeesRouter } from './routes/employees.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === env.CORS_ORIGIN) {
      res.header('Access-Control-Allow-Origin', env.CORS_ORIGIN);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
    }
    next();
  });

  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        req.header('Access-Control-Request-Headers') || 'Content-Type, Authorization'
      );
      return res.sendStatus(204);
    }
    next();
  });

  app.use(helmet());
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

  app.use('/candidates', candidatesRouter);
  app.use('/employees', employeesRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
  app.use(errorHandler);

  return app;
}