// backend/src/routes/meet.routes.ts
import { Router } from 'express';
import { z } from 'zod';

export const meetRouter = Router();

const CreateMeetInput = z.object({
  issueKey: z.string(),
  summary: z.string().optional().default('Интервью'),
  candidateEmail: z.string().email(),
  assigneeEmail: z.string().optional().default(''),
  reporterEmail: z.string().optional().default(''),
  companyEmails: z.string().optional().default(''),
  interviewDate: z.string().datetime(),
});

function timeoutAbort(ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(`timeout ${ms}ms`), ms);
  return { signal: c.signal, cancel: () => clearTimeout(t) };
}

async function postJSON(url: string, body: unknown, ms: number) {
  const { signal, cancel } = timeoutAbort(ms);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const text = await r.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    return { r, data, text };
  } finally {
    cancel();
  }
}

meetRouter.get('/meet/ping', (_req, res) => res.json({ ok: true, where: 'meetRouter', ts: Date.now() }));
meetRouter.post('/meet/echo', (req, res) => res.json({ ok: true, received: req.body }));

meetRouter.post('/meet/webhook', async (req, res) => {
  const parsed = CreateMeetInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, type: 'zod', issues: parsed.error.issues });
  }
  const body = parsed.data;

  const upstream = process.env.MEET_WEBHOOK_URL;
  if (!upstream) {
    return res.status(500).json({ ok: false, error: 'MEET_WEBHOOK_URL is not set' });
  }

  const timeoutMs = Number(process.env.MEET_WEBHOOK_TIMEOUT_MS ?? 15000);
  const retries = Math.max(0, Number(process.env.MEET_WEBHOOK_RETRIES ?? 0));

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { r, data, text } = await postJSON(upstream, body, timeoutMs);
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
      if (attempt === retries) break;
    }
  }
  return res.status(502).json({ ok: false, error: String(lastErr?.message || lastErr) });
});