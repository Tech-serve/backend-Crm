// backend/src/routes/candidates.routes.ts
import { Router } from "express";
import { z } from "zod";
import { Candidate } from "../db/models/Candidate";
import { Employee } from "../db/models/Employee";
import { CandidateSnapshot } from "../db/models/CandidateSnapshot";

export const candidatesRouter = Router();

/* ====================== DTOs ======================= */

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

const DepartmentEnum = z.enum(["Gambling","Sweeps","Search","Vitehi","Tech","TechaDeals","Admin"]);
const PositionEnum = z.enum([
  "Head","TeamLead","Buyer","Designer","Accountant","Administrator","CTO","Translator","Frontend",
]);

const StatusEnum = z.enum(["not_held","reserve","success","declined","canceled"]);

const CandidateCreateDTO = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  department: DepartmentEnum.optional(),
  position: PositionEnum.optional(),
  status: StatusEnum.optional(),        // по умолчанию “not_held”
  interview: InterviewDTO.optional(),   // можно сразу передать первое интервью
  polygraphAt: z.string().datetime().optional(),
  acceptedAt: z.string().datetime().optional(),
  declinedAt: z.string().datetime().optional(),
  canceledAt: z.string().datetime().optional(),
  polygraphAddress: z.string().optional(),
});

const CandidatePatchDTO = z.object({
  status: StatusEnum.optional(),
  meetLink: z.string().url().optional(),
  phone: z.string().optional(),
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

/* =============== helpers =============== */

function applyStatusSideEffects(update: any, nowISO: string) {
  if (!update) return;
  if (!Object.prototype.hasOwnProperty.call(update, "status")) return;

  const s: z.infer<typeof StatusEnum> = update.status;
  if (s === "success") {
    update.acceptedAt = update.acceptedAt ?? nowISO;
    update.declinedAt = null;
    update.canceledAt = null;
  } else if (s === "declined") {
    update.declinedAt = update.declinedAt ?? nowISO;
    update.acceptedAt = null;
    update.canceledAt = null;
  } else if (s === "canceled") {
    update.canceledAt = update.canceledAt ?? nowISO;
    update.acceptedAt = null;
    update.declinedAt = null;
  } else if (s === "reserve") {
    // ничего не делаем автоматически
  } else if (s === "not_held") {
    update.polygraphAt = null;
    update.acceptedAt = null;
    update.declinedAt = null;
    update.canceledAt = null;
  }
}

/* ====================== CRUD ======================= */

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
    const nowISO = new Date().toISOString();

    const doc: any = {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? "",
      notes: body.notes,
      department: body.department,
      position: body.position ?? null,
      status: body.status ?? "not_held",
      interviews: body.interview ? [body.interview] : [],
      polygraphAt: body.polygraphAt ?? null,
      acceptedAt: body.acceptedAt ?? null,
      declinedAt: body.declinedAt ?? null,
      canceledAt: body.canceledAt ?? null,
      polygraphAddress: body.polygraphAddress ?? "",
    };

    // Если “в процессе” и нет события — ставим первое интервью на сейчас
    if (doc.status === "not_held" && doc.interviews.length === 0) {
      doc.interviews.push({
        scheduledAt: nowISO,
        status: "not_held",
        source: "crm",
      });
    }

    applyStatusSideEffects(doc, nowISO);

    const cand = await Candidate.create(doc);
    res.status(201).json(cand);
  } catch (err) {
    next(err);
  }
});

candidatesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = CandidatePatchDTO.parse(req.body);

    // ⚡ Быстрый апдейт meetLink — ТОЛЬКО если в теле больше НИЧЕГО нет
    if (
      Object.prototype.hasOwnProperty.call(body, "meetLink") &&
      (!body.interviews || body.interviews.length === 0) &&
      Object.keys(body).filter((k) => k !== "meetLink").length === 0
    ) {
      const cand = await Candidate.findById(req.params.id);
      if (!cand) return res.status(404).json({ error: "Candidate not found" });
      cand.meetLink = body.meetLink!;
      if (cand.interviews?.length) cand.interviews[0].meetLink = body.meetLink!;
      await cand.save();
      return res.json(cand);
    }

    const update: any = { ...body };

    // Нормализуем position
    if (Object.prototype.hasOwnProperty.call(update, "position") && update.position === "") {
      update.position = null;
    }

    // Если прилетели interviews и при этом meetLink наверху не указан —
    // зеркалим meetLink из head-интервью (чтобы UI всегда видел верхнее поле).
    if (!update.meetLink && Array.isArray(update.interviews) && update.interviews.length > 0) {
      const head = update.interviews[0];
      if (head && head.meetLink) update.meetLink = head.meetLink;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Empty body" });
    }

    const nowISO = new Date().toISOString();
    if (update.status === "not_held") {
      update.$setOnInsert = update.$setOnInsert || {};
    }
    applyStatusSideEffects(update, nowISO);

    const candBefore = await Candidate.findById(req.params.id).lean();
    const cand = await Candidate.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
      context: "query",
    });
    if (!cand) return res.status(404).json({ error: "Candidate not found" });

    // Синхронизация с Employee при статусе success
    const wasSuccess = candBefore?.status === "success";
    const isSuccess  = cand.status === "success";
    const emailLC    = (cand.email || "").toLowerCase();

    if (isSuccess) {
      const hiredAtDate = cand.acceptedAt ? new Date(cand.acceptedAt) : new Date();
      hiredAtDate.setUTCHours(12, 0, 0, 0);

      await Employee.findOneAndUpdate(
        { $or: [{ candidate: cand._id }, { email: emailLC }] },
        {
          fullName: cand.fullName,
          email: emailLC,
          phone: cand.phone || "",
          department: cand.department || "Gambling",
          position: cand.position ?? null,
          notes: cand.notes || "",
          hiredAt: hiredAtDate,
          birthdayAt: null,
          candidate: cand._id,
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } else if (wasSuccess && !isSuccess) {
      const byCandidate = await Employee.deleteOne({ candidate: cand._id });
      if (byCandidate.deletedCount === 0 && emailLC) {
        await Employee.deleteOne({ email: emailLC });
      }
    }

    res.json(cand);
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ error: "Email already exists" });
    next(err);
  }
});

/* ====================== METRICS & SNAPSHOTS ======================= */

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

    const current: Record<StatusKey, number> = { not_held: 0, reserve: 0, success: 0, declined: 0, canceled: 0 };
    for (const r of result.current) current[r._id] = r.count;

    const monthlyMap = new Map<string, { month: string; polygraph: number; accepted: number; declined: number; canceled: number }>();
    for (const r of result.monthly) {
      const m = r._id.month.toISOString().slice(0, 7);
      if (!monthlyMap.has(m)) monthlyMap.set(m, { month: m, polygraph: 0, accepted: 0, declined: 0, canceled: 0 });
      const key = r._id.event as EventKey;
      monthlyMap.get(m)![key] = r.count;
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

candidatesRouter.get("/snapshots", async (req, res, next) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");

    const parseYM = (s: string) => {
      const [y, m] = s.split("-").map(Number);
      if (!y || !m) return null;
      return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    };

    const fromMonth = parseYM(from);
    const toMonth = parseYM(to);
    if (!fromMonth || !toMonth) return res.json({ items: [] });

    const docs = await CandidateSnapshot.find({ month: { $gte: fromMonth, $lte: toMonth } })
      .sort({ month: 1 })
      .lean();

    res.json({
      items: docs.map((d) => ({
        month: d.month.toISOString().slice(0, 7),
        ...d.counts,
      })),
    });
  } catch (err) {
    next(err);
  }
});

candidatesRouter.post("/snapshots/freeze", async (req, res, next) => {
  try {
    const ym = String(req.query.month || "");
    const now = new Date();
    const defaultMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));

    const month = (() => {
      if (!ym) return defaultMonth;
      const [y, m] = ym.split("-").map(Number);
      if (!y || !m) return defaultMonth;
      return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    })();

    const agg = await Candidate.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

    const base = { not_held: 0, reserve: 0, success: 0, declined: 0, canceled: 0 } as Record<string, number>;
    for (const r of agg) {
      if (r?._id in base) base[r._id] = r.count || 0;
    }

    const doc = await CandidateSnapshot.findOneAndUpdate(
      { month },
      { month, counts: base },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      month: doc.month.toISOString().slice(0, 7),
      ...doc.counts,
    });
  } catch (err) {
    next(err);
  }
});