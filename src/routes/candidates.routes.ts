import { Router } from 'express';
import { z } from 'zod';
import { Candidate } from '../db/models/Candidate';

export const candidatesRouter = Router();

/* ──────── DTO ──────── */

const InterviewDTO = z.object({
  scheduledAt:     z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  participants:    z.array(z.string().email()).optional(),
  meetLink:        z.string().url().optional(),
  status:          z.enum(['not_held','success','declined','canceled','reserve']).optional(),
  source:          z.enum(['jira','crm']).optional(),
  notes:           z.string().optional(),
  googleCalendarEventId: z.string().optional(),
  jiraIssueId:     z.string().optional(),
});

const CandidateCreateDTO = z.object({
  fullName:  z.string().min(1),
  email:     z.string().email(),
  notes:     z.string().optional(),
  interview: InterviewDTO.optional(),
});

/* только ТОП-уровневые поля, которые хотим апдейтить */
const CandidatePatchDTO = z.object({
  // ✔ разрешаем менять статус и meetLink
  status:   z.enum(['not_held','success','declined','canceled','reserve']).optional(),
  meetLink: z.string().url().optional(),

  notes:    z.string().optional(),
  interviews: z.array(InterviewDTO).optional(),   // если когда-то понадобится
});

/* …POST остаётся как был … */

/** PATCH /candidates/:id */
candidatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body   = CandidatePatchDTO.parse(req.body);

    const cand = await Candidate.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );
    if (!cand) return res.status(404).json({ error: 'Candidate not found' });

    res.json(cand);
  } catch (err) { next(err); }
});

/* ──────── ROUTES ──────── */

/** GET /candidates */
candidatesRouter.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(+req.query.page! || 1, 1);
    const pageSize = Math.min(Math.max(+req.query.pageSize! || 50, 1), 200);

    const [items,total] = await Promise.all([
      Candidate.find()
        .sort({ createdAt:-1 })
        .skip((page-1)*pageSize)
        .limit(pageSize)
        .lean(),
      Candidate.countDocuments(),
    ]);

    res.json({ page, pageSize, total, items });
  } catch (err) { next(err); }
});

/** POST /candidates */
candidatesRouter.post('/', async (req, res, next) => {
  try {
    const body = CandidateCreateDTO.parse(req.body);

    const cand = await Candidate.create({
      fullName:  body.fullName,
      email:     body.email,
      notes:     body.notes,
      interviews: body.interview ? [body.interview] : [],
    });

    res.status(201).json(cand);
  } catch (err) { next(err); }
});

/** PATCH /candidates/:id          ← НОВЫЙ энд-пойнт  */
candidatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = CandidatePatchDTO.parse(req.body);
    if (Object.keys(body).length === 0)
      return res.status(400).json({ error:'Empty body' });

    const cand = await Candidate.findByIdAndUpdate(
      req.params.id,
      body,
      { new:true },
    );
    if (!cand) return res.status(404).json({ error:'Candidate not found' });

    res.json(cand);
  } catch (err) { next(err); }
});

/** PATCH /candidates/:id/interviews — добавить интервью */
candidatesRouter.patch('/:id/interviews', async (req, res, next) => {
  try {
    const iv   = InterviewDTO.parse(req.body);
    const { id } = req.params;

    const cand = await Candidate.findByIdAndUpdate(
      id,
      { $push:{ interviews:iv } },
      { new:true },
    );
    if (!cand) return res.status(404).json({ error:'Candidate not found' });

    res.json(cand);
  } catch (err) { next(err); }
});