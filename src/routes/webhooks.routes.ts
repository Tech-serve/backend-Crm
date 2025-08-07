// src/routes/webhooks.routes.ts
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

webhooksRouter.post('/webhooks/jira', async (req, res, next) => {
  try {
    const data = JiraPayload.parse(req.body);

    /* 1. находим / создаём кандидата по email */
    const cand = await Candidate.findOneAndUpdate(
      { email: data.candidate.email },
      {
        $setOnInsert: {
          fullName: data.candidate.fullName || data.candidate.email.split('@')[0],
        },
      },
      { new: true, upsert: true }
    );

    /* 2. ищем внутри interviews запись с таким jiraIssueId */
    const existing = cand.interviews.find(iv => iv.jiraIssueId === data.issueId);

    if (existing) {
      // обновляем поля
      existing.scheduledAt           = new Date(data.scheduledAt);
      existing.participants          = data.participants;
      existing.meetLink              = data.meetLink;
      existing.googleCalendarEventId = data.googleCalendarEventId;
      existing.notes                 = data.summary;
    } else {
      // пушим новое интервью
      cand.interviews.push(buildInterview(data));
    }

    await cand.save();
    res.json({ ok: true, candidate: cand });
  } catch (err) {
    next(err);
  }
});