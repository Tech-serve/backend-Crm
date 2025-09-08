import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { Subscriber } from '../db/models/Subscriber';
import { sendTelegram } from '../services/telegram';

export const telegramRouter = Router();

/** Вебхук: POST /telegram/webhook/:token  ИЛИ /api/telegram/webhook/:token */
telegramRouter.post('/webhook/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (token !== env.TELEGRAM_BOT_TOKEN) {
      return res.status(401).json({ ok: false, error: 'bad token' });
    }

    const update = req.body;
    const msg  = update?.message;
    const chat = msg?.chat;

    if (!chat?.id) return res.json({ ok: true });

    const chatId = Number(chat.id);
    const text   = (msg?.text || '').trim();

    if (text.startsWith('/start')) {
      await Subscriber.updateOne(
        { chatId },
        {
          $set: {
            chatId,
            username: chat.username,
            firstName: chat.first_name,
            lastName: chat.last_name,
            enabled: true,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      try { await sendTelegram(chatId, '✅ Подписка оформлена. Будете получать уведомления о ДР и митах.'); } catch {}
    }

    return res.json({ ok: true });
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
});

/** Ручной тест рассылки: POST /telegram/test или /api/telegram/test  */
telegramRouter.post('/test', async (req, res) => {
  const text = req.body?.text || '✅ CRM: тест уведомлений';
  const subs = await Subscriber.find({ enabled: true }).lean();
  let sent = 0;
  for (const s of subs) { try { await sendTelegram(s.chatId, text); sent++; } catch {} }
  return res.json({ ok: true, sent });
});