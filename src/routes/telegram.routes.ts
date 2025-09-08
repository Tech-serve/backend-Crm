import { Router } from 'express';
import type { Request, Response } from 'express';
import { Subscriber } from '../db/models/Subscriber';
import { sendTelegram } from '../services/telegram';

export const telegramRouter = Router();

telegramRouter.post('/telegram/webhook/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const expected = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!expected || token !== expected) {
      return res.status(401).json({ ok: false });
    }

    const update = req.body;
    const msg = update?.message;
    if (msg?.chat?.id) {
      const chatId = Number(msg.chat.id);
      const text = String(msg.text || '');
      if (text.startsWith('/start')) {
        await Subscriber.updateOne(
          { chatId },
          {
            $set: {
              username:  msg.chat.username || '',
              firstName: msg.chat.first_name || '',
              lastName:  msg.chat.last_name || '',
              enabled:   true,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );
        try { await sendTelegram(chatId, '✅ Подписка оформлена. Будете получать уведомления о ДР и митах.'); } catch {}
      }
    }

    return res.json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
});

telegramRouter.post('/telegram/test', async (req: Request, res: Response) => {
  const text = req.body?.text || '✅ CRM: тест уведомлений';
  const subs = await Subscriber.find({
    $or: [{ enabled: true }, { enabled: { $exists: false } }],
  }).lean();
  let sent = 0;
  for (const s of subs) {
    try { await sendTelegram(s.chatId, text); sent++; } catch {}
  }
  return res.json({ ok: true, sent });
});