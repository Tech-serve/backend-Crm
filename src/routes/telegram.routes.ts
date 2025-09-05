import { Router } from 'express';
import type { Request, Response } from 'express';
import { Subscriber } from '../db/models/Subscriber';

export const telegramRouter = Router();

telegramRouter.post('/telegram/webhook/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    if (!process.env.TELEGRAM_BOT_TOKEN || token !== process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(401).json({ ok: false });
    }
    const update = req.body;
    const msg = update?.message;
    if (msg && msg.chat && msg.text) {
      if (typeof msg.chat.id === 'number' || typeof msg.chat.id === 'string') {
        const chatId = Number(msg.chat.id);
        if (String(msg.text).startsWith('/start')) {
          await Subscriber.updateOne(
            { chatId },
            {
              $set: {
                username: msg.chat.username || '',
                firstName: msg.chat.first_name || '',
                lastName: msg.chat.last_name || ''
              }
            },
            { upsert: true }
          );
        }
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: true }); 
  }
});
