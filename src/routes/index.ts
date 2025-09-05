import { Router } from 'express';
import { healthRouter } from './health.routes';
import { webhooksRouter } from './webhooks.routes';
import { candidatesRouter } from './candidates.routes';
import { employeesRouter } from './employees.routes';
import { meetRouter } from './meet.routes';
import { telegramRouter } from './telegram.routes';

export const apiRouter = Router();

apiRouter.use('/candidates', candidatesRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use(healthRouter);
apiRouter.use(webhooksRouter);
apiRouter.use(meetRouter);
apiRouter.use(telegramRouter);