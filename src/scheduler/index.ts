// src/scheduler/index.ts
import { Subscriber } from '../db/models/Subscriber';
import { sendTelegram } from '../services/telegram';
import { Employee } from '../db/models/Employee';
import { Candidate } from '../db/models/Candidate';
import mongoose from 'mongoose';

const TZ = process.env.APP_TZ || 'Europe/Kyiv';

function hmInTZ(d: Date, tz: string) {
  const fmtHM = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const [h, m] = fmtHM.format(d).split(':').map(Number);
  const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayKey = fmtDay.format(d);
  return { h, m, dayKey };
}

function mdInTZ(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: '2-digit', day: '2-digit' }).formatToParts(d);
  const mm = parts.find(p => p.type === 'month')!.value;
  const dd = parts.find(p => p.type === 'day')!.value;
  return `${mm}-${dd}`;
}

function displayName(e: any) {
  return (e.fullName as string) || [e.lastName, e.firstName, e.middleName].filter(Boolean).join(' ') || 'Сотрудник';
}

export function startSchedulers() {
  let lastRunDayKey = '';

  setInterval(async () => {
    try {
      const now = new Date();
      const { h, m, dayKey } = hmInTZ(now, TZ);
      if (h === 9 && m === 0 && dayKey !== lastRunDayKey) {
        lastRunDayKey = dayKey;
        await notifyBirthdays();
      }
    } catch {}
  }, 30_000);

  setInterval(async () => {
    try {
      await notifyMeetsIn60m();
    } catch {}
  }, 30_000);
}

async function notifyBirthdays() {
  const todayMD = mdInTZ(new Date(), TZ);
  const employees = await Employee.find({ birthdayAt: { $ne: null } }).lean();
  const todays = employees.filter((e: any) => mdInTZ(new Date(e.birthdayAt), TZ) === todayMD);
  if (!todays.length) return;

  const subs = await Subscriber.find({ enabled: true }).lean();
  if (!subs.length) return;

  const list = todays.map(displayName).map(n => `• ${n}`).join('\n');
  const text = `🎉 Сегодня день рождения:\n${list}`;

  for (const s of subs) {
    try { await sendTelegram((s as any).chatId, text); } catch {}
  }
}

const MeetReminder = mongoose.model('MeetReminder',
  new mongoose.Schema({ key: { type: String, unique: true }, sentAt: Date }, { collection: 'meet_reminders' })
);

async function notifyMeetsIn60m() {
  const now = new Date();
  const from = new Date(now.getTime() + 55 * 60 * 1000);
  const to   = new Date(now.getTime() + 65 * 60 * 1000);

  const cands = await Candidate.find({
    interviews: { $elemMatch: { scheduledAt: { $gte: from, $lte: to } } }
  }).lean();
  if (!cands.length) return;

  const subs = await Subscriber.find({ enabled: true }).lean();
  if (!subs.length) return;

  const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short', hour12: false });

  for (const c of cands) {
    for (const iv of (c as any).interviews || []) {
      if (!iv?.scheduledAt) continue;
      const t = new Date(iv.scheduledAt);
      if (t < from || t > to) continue;

      const key = `${(c as any)._id}:${t.toISOString()}`;
      const ins: any = await MeetReminder.updateOne(
        { key },
        { $setOnInsert: { sentAt: new Date() } },
        { upsert: true }
      );
      if (ins.matchedCount && !ins.upsertedId) continue;

      const who = (c as any).fullName || 'Кандидат';
      const title = iv.notes || 'Собеседование';
      const when  = fmt.format(t);
      const link  = iv.meetLink ? `\n${iv.meetLink}` : '';
      const text  = `⏰ Через час: ${title} с «${who}»\n${when}${link}`;

      for (const s of subs) {
        try { await sendTelegram((s as any).chatId, text); } catch {}
      }
    }
  }
}