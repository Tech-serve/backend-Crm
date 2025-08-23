import { Router } from 'express';
import { z } from 'zod';
import { Candidate } from '../db/models/Candidate';

export const webhooksRouter = Router();

/* --- ожидаемый payload от Jira ------------------------------------------------ */

const JiraPayload = z.object({
  issueId:    z.string(),                // PO2-123
  summary:    z.string().optional(),     // Заголовок задачи
  candidate:  z.object({
    email:    z.string().email(),
    fullName: z.string().optional(),
  }),
  scheduledAt: z.string().datetime(),
  participants: z.array(z.string().email()).optional().default([]),
  meetLink:     z.string().url().optional(),
  googleCalendarEventId: z.string().optional(),
});

/* --- helper: собираем sub-document ------------------------------------------- */

function buildInterview(p: z.infer<typeof JiraPayload>) {
  return {
    scheduledAt:     new Date(p.scheduledAt),
    durationMinutes: 60,
    participants:    p.participants,
    meetLink:        p.meetLink,
    status:          'not_held',
    source:          'jira',
    googleCalendarEventId: p.googleCalendarEventId,
    jiraIssueId:     p.issueId,
    notes:           p.summary,
  };
}

/* --- POST /webhooks/jira ------------------------------------------------------ */

webhooksRouter.post('/webhooks/jira', async (req, res) => {
  // Чёткая диагностика входа (не «немой» 500)
  const parsed = JiraPayload.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, type: 'zod', issues: parsed.error.issues });
  }
  const data = parsed.data;

  try {
    const cand: any = await Candidate.findOneAndUpdate(
      { email: data.candidate.email },
      {
        $setOnInsert: {
          fullName: data.candidate.fullName || data.candidate.email.split('@')[0],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!Array.isArray(cand.interviews)) {
      cand.interviews = [];
    }

    const existing = cand.interviews.find((iv: any) => iv.jiraIssueId === data.issueId);

    if (existing) {
      existing.scheduledAt           = new Date(data.scheduledAt);
      existing.participants          = data.participants;
      existing.meetLink              = data.meetLink;
      existing.googleCalendarEventId = data.googleCalendarEventId;
      existing.notes                 = data.summary;
    } else {
      cand.interviews.push(buildInterview(data));
    }

    await cand.save();
    return res.json({ ok: true, candidate: { _id: cand._id, email: cand.email } });
  } catch (err: any) {
    console.error('WEBHOOK/JIRA ERROR', err?.message || err);
    return res.status(500).json({ ok: false, type: 'server', error: String(err?.message || err) });
  }
});