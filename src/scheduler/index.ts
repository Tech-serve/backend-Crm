// src/scheduler/index.ts
import { Subscriber } from '../db/models/Subscriber';
import { sendTelegram } from '../services/telegram';
import { Employee } from '../db/models/Employee';

const TZ = process.env.APP_TZ || 'Europe/Kyiv';

function hmInTZ(d: Date, tz: string) {
  const fmtHM = new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = fmtHM.format(d).split(':').map(Number);

  // YYYY-MM-DD в заданной TZ (чтобы lastRunDayKey был именно «киевским» днём)
  const fmtDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dayKey = fmtDay.format(d); // например "2025-09-08"

  return { h, m, dayKey };
}

function mdInTZ(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const mm = parts.find(p => p.type === 'month')!.value;
  const dd = parts.find(p => p.type === 'day')!.value;
  return `${mm}-${dd}`; // "09-08"
}

function displayName(e: any) {
  return (e.fullName as string)
      || [e.lastName, e.firstName, e.middleName].filter(Boolean).join(' ')
      || 'Сотрудник';
}

/** Запуск простых планировщиков */
export function startSchedulers() {
  let lastRunDayKey = '';

  setInterval(async () => {
    try {
      const now = new Date();
      const { h, m, dayKey } = hmInTZ(now, TZ);

      // 09:00 по Киеву — поздравления с ДР
      if (h === 9 && m === 0 && dayKey !== lastRunDayKey) {
        lastRunDayKey = dayKey;
        await notifyBirthdays();
      }
    } catch {
      // проглатываем, чтобы не ронять цикл
    }
  }, 30_000);
}

async function notifyBirthdays() {
  // считаем «сегодня» в TZ
  const todayMD = mdInTZ(new Date(), TZ);

  const employees = await Employee.find({ birthdayAt: { $ne: null } }).lean();
  const todays = employees.filter((e: any) =>
    mdInTZ(new Date(e.birthdayAt), TZ) === todayMD
  );

  if (!todays.length) return;

  const subs = await Subscriber.find({ enabled: true }).lean();
  if (!subs.length) return;

  const list = todays.map(displayName).map(n => `• ${n}`).join('\n');
  const text = `🎉 Сегодня день рождения:\n${list}`;

  for (const s of subs) {
    try { await sendTelegram(s.chatId, text); } catch {}
  }
}