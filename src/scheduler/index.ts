import { Subscriber } from '../db/models/Subscriber';
import { sendTelegram } from '../services/telegram';
// Если у тебя модель Employees в другом месте — поправь импорт ниже
import { Employee } from '../db/models/Employee';

/** Запуск простых планировщиков */
export function startSchedulers() {
  let lastRunDayKey = '';

  setInterval(async () => {
    try {
      // 09:00 Europe/Moscow — поздравления с ДР
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const [h, m] = fmt.format(now).split(':').map(Number);
      const dayKey = now.toISOString().slice(0, 10);

      if (h === 9 && m === 0 && dayKey !== lastRunDayKey) {
        lastRunDayKey = dayKey;
        await notifyBirthdays();
      }
    } catch {
      // проглатываем — чтобы не ронять цикл
    }
  }, 30 * 1000);
}

async function notifyBirthdays() {
  const today = new Date();
  const tMonth = today.getUTCMonth();
  const tDate  = today.getUTCDate();

  const employees = await Employee.find({ birthdayAt: { $ne: null } }).lean();
  const todays = employees.filter((e: any) => {
    const d = new Date(e.birthdayAt);
    return d.getUTCMonth() === tMonth && d.getUTCDate() === tDate;
  });
  if (!todays.length) return;

  const subs = await Subscriber.find({ enabled: true }).lean();
  if (!subs.length) return;

  const list = todays
    .map((e: any) => {
      const fio = [e.lastName, e.firstName, e.middleName].filter(Boolean).join(' ');
      return `• ${fio}`.trim();
    })
    .join('\n');

  const text = `🎉 Сегодня день рождения:\n${list}`;
  for (const s of subs) {
    try { await sendTelegram(s.chatId, text); } catch {}
  }
}