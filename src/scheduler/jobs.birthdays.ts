import type Agenda from 'agenda';
import { Employee } from '../db/models/Employee';
import { Subscriber } from '../db/models/Subscriber';
import { APP_TZ, makeZonedDateUTC, nextBirthdayFrom } from '../utils/time';

function fmtName(e: any) { return e.fullName || e.email || 'Сотрудник'; }

export async function scheduleBirthdayJobs(agenda: Agenda) {
  const employees = await Employee.find({ birthdayAt: { $ne: null } }).select({ fullName:1, birthdayAt:1 }).lean();
  const subs = await Subscriber.find({}).select({ chatId:1 }).lean();
  const chatIds = subs.map(s => s.chatId);
  const now = new Date();

  for (const e of employees) {
    if (!e.birthdayAt) continue;
    const { y, m1, d } = nextBirthdayFrom(new Date(e.birthdayAt), now, APP_TZ);

    const dayBefore = new Date(makeZonedDateUTC(y, m1, d, 12, 0, APP_TZ).getTime() - 24*60*60*1000);
    const dayOf09 = makeZonedDateUTC(y, m1, d, 9, 0, APP_TZ);

    const baseData = { employeeId: String((e as any)._id), date: `${y}-${String(m1).padStart(2,'0')}-${String(d).padStart(2,'0')}` };
    const now1 = new Date();

    await agenda
      .create('notify:birthday', { ...baseData, when: 'day-before-12', chatIds, text: `🎂 Завтра день рождения: <b>${fmtName(e)}</b>` })
      .unique({ k: 'bd', ...baseData, when: 'd-1-12' }, { insertOnly: true })
      .schedule(dayBefore > now1 ? dayBefore : new Date(now1.getTime() + 365*24*60*60*1000))
      .save();

    await agenda
      .create('notify:birthday', { ...baseData, when: 'day-of-09', chatIds, text: `🎉 Сегодня день рождения: <b>${fmtName(e)}</b>` })
      .unique({ k: 'bd', ...baseData, when: 'd-0-09' }, { insertOnly: true })
      .schedule(dayOf09 > now1 ? dayOf09 : new Date(now1.getTime() + 365*24*60*60*1000))
      .save();
  }
}