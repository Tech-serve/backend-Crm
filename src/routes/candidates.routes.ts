import { Router } from "express";
import { z } from "zod";
import { Candidate } from "../db/models/Candidate";

export const candidatesRouter = Router();

const InterviewDTO = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  participants: z.array(z.string().email()).optional(),
  meetLink: z.string().url().optional(),
  status: z.enum(["not_held", "success", "declined", "canceled", "reserve"]).optional(),
  source: z.enum(["jira", "crm"]).optional(),
  notes: z.string().optional(),
  googleCalendarEventId: z.string().optional(),
  jiraIssueId: z.string().optional(),
});

const DepartmentEnum = z.enum([
  "Gambling",
  "Sweeps",
  "Search",
  "Vitehi",
  "Tech",
  "TechaDeals",
  "Admin",
]);

const PositionEnum = z.enum([
  "Head",
  "TeamLead",
  "Buyer",
  "Designer",
  "Accountant",
  "Administrator",
  "CTO",
  "Translator",
  "Frontend",
]);

const CandidateCreateDTO = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  notes: z.string().optional(),
  department: DepartmentEnum.optional(),
  position: PositionEnum.optional(),
  interview: InterviewDTO.optional(),
  polygraphAt: z.string().datetime().optional(),
  acceptedAt: z.string().datetime().optional(),
  declinedAt: z.string().datetime().optional(),
  canceledAt: z.string().datetime().optional(),
  polygraphAddress: z.string().optional(),
});

const CandidatePatchDTO = z.object({
  status: z.enum(["not_held","success","declined","canceled","reserve"]).optional(),
  meetLink: z.string().url().optional(),
  notes: z.string().optional(),
  department: DepartmentEnum.optional(),
  position: z.union([PositionEnum, z.literal(""), z.null()]).optional(),
  interviews: z.array(InterviewDTO).optional(),
  polygraphAt: z.string().datetime().nullable().optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
  declinedAt: z.string().datetime().nullable().optional(),
  canceledAt: z.string().datetime().nullable().optional(),
  polygraphAddress: z.string().nullable().optional(),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
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
      position: body.position ?? null,
      interviews: body.interview ? [body.interview] : [],
      polygraphAt: body.polygraphAt,
      acceptedAt: body.acceptedAt,
      declinedAt: body.declinedAt,
      canceledAt: body.canceledAt,
      polygraphAddress: body.polygraphAddress,
    });
    res.status(201).json(cand);
  } catch (err) {
    next(err);
  }
});

candidatesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = CandidatePatchDTO.parse(req.body);

    // приводим "" → null для position
    const update: any = { ...body };
    if (Object.prototype.hasOwnProperty.call(update, "position") && update.position === "") {
      update.position = null;
    }

    if (Object.keys(update).length === 0) return res.status(400).json({ error: "Empty body" });

    const cand = await Candidate.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
      context: "query",
    });
    if (!cand) return res.status(404).json({ error: "Candidate not found" });
    res.json(cand);
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ error: "Email already exists" });
    next(err);
  }
});

candidatesRouter.get("/metrics", async (req, res, next) => {
  try {
    const tz = "Europe/Kyiv";
    const from = req.query.from ? new Date(String(req.query.from)) : new Date("1970-01-01");
    const to = req.query.to ? new Date(String(req.query.to)) : new Date("2999-12-31");

    type EventKey = "polygraph" | "accepted" | "declined" | "canceled";
    type StatusKey = "not_held" | "reserve" | "success" | "declined" | "canceled";
    type FacetResult = {
      current: { _id: StatusKey; count: number }[];
      monthly: { _id: { event: EventKey; month: Date }; count: number }[];
      firstTouches: { _id: { month: Date }; count: number }[];
    };

    const [result] = (await Candidate.aggregate([
      {
        $project: {
          status: 1,
          createdAt: 1,
          events: [
            { event: "polygraph", at: "$polygraphAt" },
            { event: "accepted", at: "$acceptedAt" },
            { event: "declined", at: "$declinedAt" },
            { event: "canceled", at: "$canceledAt" },
          ],
        },
      },
      {
        $facet: {
          current: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          monthly: [
            { $unwind: "$events" },
            { $match: { "events.at": { $ne: null, $gte: from, $lte: to } } },
            {
              $group: {
                _id: {
                  event: "$events.event",
                  month: { $dateTrunc: { date: "$events.at", unit: "month", timezone: tz } },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { "_id.month": 1 } },
          ],
          firstTouches: [
            { $match: { createdAt: { $gte: from, $lte: to } } },
            {
              $group: {
                _id: { month: { $dateTrunc: { date: "$createdAt", unit: "month", timezone: tz } } },
                count: { $sum: 1 },
              },
            },
            { $sort: { "_id.month": 1 } },
          ],
        },
      },
    ])) as [FacetResult];

    const current: Record<StatusKey, number> = {
      not_held: 0,
      reserve: 0,
      success: 0,
      declined: 0,
      canceled: 0,
    };
    for (const r of result.current) current[r._id] = r.count;

    const monthlyMap = new Map<
      string,
      { month: string; polygraph: number; accepted: number; declined: number; canceled: number }
    >();
    for (const r of result.monthly) {
      const m = r._id.month.toISOString().slice(0, 7);
      if (!monthlyMap.has(m)) {
        monthlyMap.set(m, { month: m, polygraph: 0, accepted: 0, declined: 0, canceled: 0 });
      }
      const key: EventKey = r._id.event;
      const bucket = monthlyMap.get(m)!;
      bucket[key] = r.count;
    }

    const firstTouches = result.firstTouches.map((r) => ({
      month: r._id.month.toISOString().slice(0, 7),
      created: r.count,
    }));

    res.json({ current, monthly: Array.from(monthlyMap.values()), firstTouches });
  } catch (err) {
    next(err);
  }
});