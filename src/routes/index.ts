import { Router } from 'express';
import { healthRouter } from './health.routes';
import { webhooksRouter } from './webhooks.routes';
import { candidatesRouter } from './candidates.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(candidatesRouter);
apiRouter.use(webhooksRouter);