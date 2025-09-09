// backend/src/routes/telegram.routes.ts
import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { Subscriber } from '../db/models/Subscriber';
import { sendTelegram } from '../services/telegram';

export const telegramRouter = Router();

/** Вебхук: /telegram/webhook/:token */
telegramRouter.post('/telegram/webhook/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!env.TELEGRAM_BOT_TOKEN || token !== env.TELEGRAM_BOT_TOKEN) {
      return res.status(401).json({ ok: false, error: 'bad token' });
    }

    const msg  = req.body?.message;
    const chat = msg?.chat;
    const text = (msg?.text || '').trim().toLowerCase();

    if (chat?.id && text.startsWith('/start')) {
      const chatId = Number(chat.id);
      await Subscriber.updateOne(
        { chatId },
        {
          $set: {
            chatId,
            username: chat.username || '',
            firstName: chat.first_name || '',
            lastName: chat.last_name || '',
            enabled: true, // ← автоматически включаем рассылку
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      try {
        await sendTelegram(chatId, '✅ Подписка оформлена. Будете получать уведомления о ДР и митах.');
      } catch {}
    }

    return res.json({ ok: true });
  } catch {
    // Никогда не роняем вебхук — Telegram ждёт 200
    return res.status(200).json({ ok: true });
  }
});

/** Ручной тест рассылки: POST /telegram/test {text?: string} */
telegramRouter.post('/telegram/test', async (req: Request, res: Response) => {
  const text = (req.body?.text as string) || '✅ CRM: тест уведомлений';
  const subs = await Subscriber.find({ enabled: true }).lean();
  let sent = 0;
  for (const s of subs) {
    try { await sendTelegram(s.chatId, text); sent++; } catch {}
  }
  return res.json({ ok: true, sent });
});