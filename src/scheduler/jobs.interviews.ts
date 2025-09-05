import type Agenda from 'agenda';
import { Candidate } from '../db/models/Candidate';
import { Subscriber } from '../db/models/Subscriber';
import { minusMinutes } from '../utils/time';

function pickFirstInterview(c: any) {
  if (!Array.isArray(c.interviews) || c.interviews.length === 0) return null;
  return c.interviews[0];
}

export async function scheduleInterviewJobs(agenda: Agenda) {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48*60*60*1000);
  const subs = await Subscriber.find({}).select({ chatId:1 }).lean();
  const chatIds = subs.map(s => s.chatId);

  const cand = await Candidate.find({
    'interviews.0.scheduledAt': { $gte: now, $lte: in48h },
    status: { $in: ['not_held', 'reserve'] }
  }).select({ fullName:1, email:1, interviews:1 }).lean();

  for (const c of cand) {
    const itw = pickFirstInterview(c);
    if (!itw || !itw.scheduledAt) continue;
    const schedAt = new Date(itw.scheduledAt);
    const at = minusMinutes(schedAt, 60);

    const baseData = { candidateId: String((c as any)._id), scheduledAt: schedAt.toISOString() };
    const text = `🕘 Через час интервью: <b>${c.fullName || c.email}</b>\nКогда: ${schedAt.toLocaleString('uk-UA')}`;

    await agenda
      .create('notify:interview', { ...baseData, chatIds, text })
      .unique({ k: 'itw-1h', ...baseData }, { insertOnly: true })
      .schedule(at)
      .save();
  }
}
