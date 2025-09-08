import { env } from '../config/env';
import { request } from 'https';
import { URLSearchParams } from 'url';

const BASE = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export function sendTelegram(chatId: number|string, text: string) {
  return new Promise<void>((resolve, reject) => {
    const body = new URLSearchParams({
      chat_id: String(chatId),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: 'true',
    }).toString();

    const req = request(`${BASE}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) return resolve();
        return reject(new Error(`Telegram ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}