import { Subscriber } from '../db/models/Subscriber';
import { sendTelegram } from '../services/telegram';
import { Employee } from '../db/models/Employee';
import { Candidate } from '../db/models/Candidate';

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

function fmtKyiv(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function displayName(e: any) {
  return (e.fullName as string) || [e.lastName, e.firstName, e.middleName].filter(Boolean).join(' ') || 'Сотрудник';
}

export async function runMeets1hOnce() {
  const now = Date.now();

  const subs = await Subscriber.find({ enabled: true }).lean();
  if (!subs.length) return { checked: 0, matched: 0, delivered: 0, items: [], note: 'no subscribers' };

  const candidates = await Candidate.find(
    { 'interviews.0.scheduledAt': { $exists: true } },
    { fullName: 1, email: 1, interviews: { $slice: 1 } }
  ).lean();

  let checked = 0, matched = 0, delivered = 0;
  const items: Array<{ id: string; when: string; name: string; sent: boolean }> = [];

  for (const c of candidates) {
    const head = Array.isArray(c.interviews) ? (c.interviews[0] as any) : null;
    if (!head?.scheduledAt) continue;

    const when = new Date(head.scheduledAt);
    if (isNaN(+when)) continue;

    checked++;

    const diffSec = (when.getTime() - now) / 1000;
    if (diffSec >= 60 * 60 - 90 && diffSec <= 60 * 60 + 90) {
      const upd = await Candidate.updateOne(
        { _id: c._id },
        {
          $set: { 'interviews.$[head].reminded1hAt': new Date().toISOString() }
        },
        {
          arrayFilters: [{ 'head.scheduledAt': head.scheduledAt }],
          strict: false
        }
      );

      let sent = false;
      if (upd.modifiedCount === 1) {
        matched++;
        const label = (c as any).fullName || (c as any).email || `Кандидат ${c._id}`;
        const link  = head.meetLink ? `\n${head.meetLink}` : '';
        const text  = `⏰ Через 1 час звонок:\n• ${fmtKyiv(when)} — ${label}${link}`;
        for (const s of subs) { try { await sendTelegram(s.chatId, text); sent = true; delivered++; } catch {} }
      }

      items.push({ id: String(c._id), when: when.toISOString(), name: (c as any).fullName || (c as any).email || '', sent });
    }
  }

  const summary = { checked, matched, delivered, items };
  console.log('[MEET1H]', summary);
  return summary;
}

export function startSchedulers() {
  let last09Key = '';
  let last12Key = '';

  setInterval(async () => {
    try {
      const now = new Date();
      const { h, m, dayKey } = hmInTZ(now, TZ);

      if (h === 9 && m === 0 && dayKey !== last09Key) {
        last09Key = dayKey;
        await notifyBirthdaysToday();
      }
      if (h === 12 && m === 0 && dayKey !== last12Key) {
        last12Key = dayKey;
        await notifyBirthdaysIn7Days();
      }

      await runMeets1hOnce();
    } catch (e) {
      console.warn('[SCHED] cycle error:', (e as any)?.message || e);
    }
  }, 30_000);
}

async function notifyBirthdaysToday() {
  const todayMD = mdInTZ(new Date(), TZ);
  const employees = await Employee.find({ birthdayAt: { $ne: null } }).lean();
  const todays = employees.filter((e: any) => mdInTZ(new Date(e.birthdayAt), TZ) === todayMD);
  if (!todays.length) return;

  const subs = await Subscriber.find({ enabled: true }).lean();
  if (!subs.length) return;

  const list = todays.map(displayName).map(n => `• ${n}`).join('\n');
  const text = `🎉 Сегодня день рождения:\n${list}`;
  for (const s of subs) { try { await sendTelegram(s.chatId, text); } catch {} }
}

async function notifyBirthdaysIn7Days() {
  const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const targetMD = mdInTZ(target, TZ);

  const employees = await Employee.find({ birthdayAt: { $ne: null } }).lean();
  const soon = employees.filter((e: any) => mdInTZ(new Date(e.birthdayAt), TZ) === targetMD);
  if (!soon.length) return;

  const subs = await Subscriber.find({ enabled: true }).lean();
  if (!subs.length) return;

  const list = soon.map(displayName).map(n => `• ${n}`).join('\n');
  const text = `📅 Ровно через неделю день рождения:\n${list}`;
  for (const s of subs) { try { await sendTelegram(s.chatId, text); } catch {} }
}