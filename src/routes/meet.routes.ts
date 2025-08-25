// backend/src/routes/meet.routes.ts
import { Router } from 'express';
import { z } from 'zod';

export const meetRouter = Router();

meetRouter.get('/meet/ping', (_req, res) =>
  res.json({ ok: true, where: 'meetRouter', ts: Date.now() })
);
meetRouter.post('/meet/echo', (req, res) =>
  res.json({ ok: true, received: req.body })
);

/** нормализация списков e-mail в "a@b.com,b@c.com" */
function normalizeEmails(input: unknown): string {
  const list = Array.isArray(input)
    ? input
    : String(input ?? '')
        .split(/[\s,;]+/)
        .filter(Boolean);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const uniq = Array.from(new Set(list.map(String).map(s => s.trim()).filter(e => emailRe.test(e))));
  return uniq.join(',');
}

const CreateMeetInput = z
  .object({
    issueKey: z.string().min(1),
    summary: z.string().optional().default('Интервью'),
    candidateEmail: z.string().email(),
    assigneeEmail: z.string().email().optional().or(z.literal('')).default(''),
    reporterEmail: z.string().email().optional().or(z.literal('')).default(''),
    companyEmails: z.union([z.string(), z.array(z.string().email())]).optional().default(''),
    interviewDate: z.string().datetime({ offset: true }),
  })
  .transform(v => ({
    ...v,
    companyEmails: normalizeEmails(v.companyEmails),
  }));

function timeoutAbort(ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(new Error(`timeout ${ms}ms`)), ms);
  return { signal: c.signal, cancel: () => clearTimeout(t) };
}

async function postJSON(url: string, body: unknown, ms: number) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch is not available (Node 18+ required)');
  }
  const { signal, cancel } = timeoutAbort(ms);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const text = await r.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch 
    { /* ignore parse */ }
    return { r, data, text };
  } finally {
    cancel();
  }
}

meetRouter.post('/meet/webhook', async (req, res) => {
  const parsed = CreateMeetInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, type: 'zod', issues: parsed.error.issues });
  }

  const upstream = process.env.MEET_WEBHOOK_URL;
  if (!upstream) {
    return res.status(500).json({ ok: false, error: 'MEET_WEBHOOK_URL is not set' });
  }

  const timeoutMs = Number(process.env.MEET_WEBHOOK_TIMEOUT_MS ?? 45000);
  const retries   = Math.max(0, Number(process.env.MEET_WEBHOOK_RETRIES ?? 0));
  const debug     = process.env.DEBUG_MEET === '1';

  const bodyBase = parsed.data;
  const body = {
    ...bodyBase,
    interviewDate: new Date(bodyBase.interviewDate).toISOString(),
  };

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const t0 = Date.now();
    try {
      const { r, data, text } = await postJSON(upstream, body, timeoutMs);
      if (debug) console.log('[MEET]', { attempt, t_ms: Date.now() - t0, status: r.status, ok: r.ok });

      if (!r.ok) {
        return res.status(r.status).json({ ok: false, upstream: true, body: text || data });
      }

      const link = data?.meetLink || data?.link || data?.url;
      if (!link || typeof link !== 'string') {
        return res.status(502).json({ ok: false, error: 'No meetLink from upstream', body: data });
      }
      return res.json({ ok: true, meetLink: link });
    } catch (e: any) {
      lastErr = e;
      if (debug) console.log('[MEET_ERR]', { attempt, t_ms: Date.now() - t0, error: String(e?.message || e) });
      if (attempt === retries) break;
    }
  }

  return res.status(502).json({ ok: false, error: String(lastErr?.message || lastErr) });
});