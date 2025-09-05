// src/utils/telegram.ts
import * as https from 'https';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8207780284:AAFGvmnqZ88yMWHZJ_w_HykltSeaISOyN5g';

export function assertTelegramConfigured() {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set');
}

export async function sendTelegramMessage(chatId: number | string, text: string) {
  assertTelegramConfigured();
  const postData = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  };
  await new Promise<void>((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c as Buffer));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`Telegram API ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}