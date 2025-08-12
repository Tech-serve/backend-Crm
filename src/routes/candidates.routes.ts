import { Router } from "express";
import { z } from "zod";
import { Candidate } from "../db/models/Candidate";

export const candidatesRouter = Router();

const InterviewDTO = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  participants: z.array(z.string().email()).optional(),
  meetLink: z.string().url().optional(),
  status: z
    .enum(["not_held", "success", "declined", "canceled", "reserve"])
    .optional(),
  source: z.enum(["jira", "crm"]).optional(),
  notes: z.string().optional(),
  googleCalendarEventId: z.string().optional(),
  jiraIssueId: z.string().optional(),
});

const CandidateCreateDTO = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  notes: z.string().optional(),
  department: z
    .enum([
      "Геймблинг",
      "Свипы",
      "Сёрч",
      "Дизайнеры",
      "Техи",
      "Админ персонал",
    ])
    .optional(),
  interview: InterviewDTO.optional(),
});

const CandidatePatchDTO = z.object({
  status: z
    .enum(["not_held", "success", "declined", "canceled", "reserve"])
    .optional(),
  meetLink: z.string().url().optional(),
  notes: z.string().optional(),
  department: z
    .enum([
      "Геймблинг",
      "Свипы",
      "Сёрч",
      "Дизайнеры",
      "Техи",
      "Админ персонал",
    ])
    .optional(),
  interviews: z.array(InterviewDTO).optional(),

  polygraphAt: z.string().datetime().optional(),
  acceptedAt:  z.string().datetime().optional(),
  declinedAt:  z.string().datetime().optional(),
  canceledAt:  z.string().datetime().optional(),
  polygraphAddress: z.string().nullable().optional(),
});

candidatesRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(+req.query.page! || 1, 1);
    const pageSize = Math.min(Math.max(+req.query.pageSize! || 50, 1), 200);
    const [items, total] = await Promise.all([
      Candidate.find().sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Candidate.countDocuments(),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (err) {
    next(err);
  }
});

candidatesRouter.post("/", async (req, res, next) => {
  try {
    const body = CandidateCreateDTO.parse(req.body);
    const cand = await Candidate.create({
      fullName: body.fullName,
      email: body.email,
      notes: body.notes,
      department: body.department,
      interviews: body.interview ? [body.interview] : [],
    });
    res.status(201).json(cand);
  } catch (err) {
    next(err);
  }
});

candidatesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = CandidatePatchDTO.parse(req.body);
    if (Object.keys(body).length === 0)
      return res.status(400).json({ error: "Empty body" });
    const cand = await Candidate.findByIdAndUpdate(req.params.id, body, {
      new: true,
    });
    if (!cand) return res.status(404).json({ error: "Candidate not found" });
    res.json(cand);
  } catch (err) {
    next(err);
  }
});

candidatesRouter.patch("/:id/interviews", async (req, res, next) => {
  try {
    const iv = InterviewDTO.parse(req.body);
    const cand = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $push: { interviews: iv } },
      { new: true }
    );
    if (!cand) return res.status(404).json({ error: "Candidate not found" });
    res.json(cand);
  } catch (err) {
    next(err);
  }
});