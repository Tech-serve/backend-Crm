import Agenda from 'agenda';
import { env } from '../config/env';
import { scheduleBirthdayJobs } from './jobs.birthdays';
import { scheduleInterviewJobs } from './jobs.interviews';

export let agenda: Agenda;

export async function startScheduler(mongoUri?: string) {
  const uri = mongoUri || env.MONGODB_URI;
  agenda = new Agenda({ db: { address: uri, collection: 'agendaJobs' } });
  defineJobs(agenda);
  await agenda.start();

  await agenda.every('15 minutes', 'sync:interview-reminders', {});
  await agenda.every('1 day', 'sync:birthday-reminders', {}, { timezone: process.env.APP_TZ || 'Europe/Kyiv' });
}

function defineJobs(agenda: Agenda) {
  // явные типы, чтобы убрать implicit any
  agenda.define('sync:birthday-reminders', async (_job: unknown) => {
    await scheduleBirthdayJobs(agenda);
  });

  agenda.define('sync:interview-reminders', async (_job: unknown) => {
    await scheduleInterviewJobs(agenda);
  });

  agenda.define('notify:birthday', async (job: any) => {
    const data = job.attrs.data as any;
    const { text, chatIds } = data || {};
    if (!Array.isArray(chatIds) || !text) return;
    const { sendTelegramMessage } = await import('../utils/telegram');
    for (const id of chatIds) { try { await sendTelegramMessage(id, text); } catch {} }
  });

  agenda.define('notify:interview', async (job: any) => {
    const data = job.attrs.data as any;
    const { text, chatIds } = data || {};
    if (!Array.isArray(chatIds) || !text) return;
    const { sendTelegramMessage } = await import('../utils/telegram');
    for (const id of chatIds) { try { await sendTelegramMessage(id, text); } catch {} }
  });
}