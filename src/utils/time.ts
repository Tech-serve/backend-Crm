// src/utils/time.ts
// Minimal timezone helpers without extra deps. Uses Intl API to compute offsets.
export const APP_TZ = process.env.APP_TZ || 'Europe/Kyiv';

function getTzOffsetMinutes(atUtc: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'shortOffset'
  });
  const parts = dtf.formatToParts(atUtc);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0';
  // tzName like "GMT+3" or "GMT+03:00"
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const hh = parseInt(m[2] || '0', 10);
  const mm = parseInt(m[3] || '0', 10);
  return sign * (hh * 60 + mm);
}

/** Create a UTC Date that corresponds to local wall time in given TZ */
export function makeZonedDateUTC(y: number, m1: number, d: number, hh = 0, mm = 0, timeZone = APP_TZ): Date {
  // approximate UTC at that wall time
  const approxUtc = new Date(Date.UTC(y, m1 - 1, d, hh, mm));
  const offsetMin = getTzOffsetMinutes(approxUtc, timeZone);
  const utcMs = Date.UTC(y, m1 - 1, d, hh, mm) - offsetMin * 60_000;
  return new Date(utcMs);
}

export function nextBirthdayFrom(birthdayAt: Date, now = new Date(), timeZone = APP_TZ): { y: number, m1: number, d: number } {
  const b = new Date(birthdayAt);
  const yNow = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(now);
  let y = parseInt(yNow, 10);
  const m1 = b.getUTCMonth() + 1;
  const d = b.getUTCDate();
  const dayThisYearUTC = makeZonedDateUTC(y, m1, d, 0, 0, timeZone);
  if (dayThisYearUTC.getTime() < now.getTime()) {
    y += 1;
  }
  return { y, m1, d };
}

export function minusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60_000);
}

export function toIso(date: Date): string { return date.toISOString(); }
