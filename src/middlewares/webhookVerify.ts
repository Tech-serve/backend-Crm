import { Request, Response, NextFunction } from 'express';

export function webhookVerify(req: Request, res: Response, next: NextFunction) {
  const token = (req.query.token as string) || req.header('x-webhook-token');
  if (!token || token !== process.env.JIRA_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }
  next();
}