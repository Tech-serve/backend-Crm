// src/routes/telegram.routes.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { Subscriber } from '../db/models/Subscriber';
import { sendTelegramMessage } from '../utils/telegram';

export const telegramRouter = Router();

/**
 * Вебхук Telegram. URL должен быть ровно:
 * https://<домен>/telegram/webhook/<TOKEN>
 */
telegramRouter.post('/telegram/webhook/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    if (!process.env.TELEGRAM_BOT_TOKEN || token !== process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(401).json({ ok: false });
    }

    const update = req.body;
    const msg = update?.message;
    if (msg && msg.chat && msg.text) {
      const id = msg.chat.id;
      if (typeof id === 'number' || typeof id === 'string') {
        const chatId = Number(id);

        // сохраняем подписчика при /start
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

          // отправим привет (полезно увидеть, что доставляется)
          try { await sendTelegramMessage(chatId, '✅ Подписка включена. Буду присылать уведомления.'); } catch {}
        }
      }
    }
    return res.json({ ok: true });
  } catch {
    // Telegram ждёт 200, иначе начнёт ретраить — поэтому 200
    return res.status(200).json({ ok: true });
  }
});

/** НЕ обязательно. Временный дебаг-роут — проверить отправку вручную.
 * Удали/закрой после проверки. Простейшая защита — токен в query.
 * GET /telegram/test?token=<BOT_TOKEN>&chatId=123
 */
telegramRouter.get('/telegram/test', async (req, res) => {
  if (req.query.token !== process.env.TELEGRAM_BOT_TOKEN) return res.status(401).json({ ok:false });
  const chatId = Number(req.query.chatId);
  if (!chatId) return res.status(400).json({ ok:false, error: 'chatId required' });
  try {
    await sendTelegramMessage(chatId, '🔔 Test message from CRM');
    return res.json({ ok:true });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});