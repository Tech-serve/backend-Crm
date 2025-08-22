import { Router } from "express";
import { z } from "zod";
import { Employee } from "../db/models/Employee";
import { Candidate } from "../db/models/Candidate";

export const employeesRouter = Router();

const DepartmentEnum = z.enum([
  "Gambling", "Sweeps", "Search", "Vitehi", "Tech", "TechaDeals", "Admin",
]);
const PositionEnum = z.enum([
  "Head","TeamLead","Buyer","Designer","Accountant","Administrator","CTO","Translator","Frontend",
]);

const normEmail = (e: string) => e.trim().toLowerCase();
const dateOrNull = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : new Date(String(v));
const normalizeDateOnly = (v: unknown) => {
  const d = dateOrNull(v);
  if (!d) return null;
  d.setUTCHours(12, 0, 0, 0);
  return d;
};

// ---------- DTO ----------
const EmployeeCreateDTO = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  department: DepartmentEnum,
  position: z.union([PositionEnum, z.null()]).optional(),
  notes: z.string().optional(),
  birthdayAt: z.string().datetime().nullable().optional(),
  hiredAt: z.string().datetime().optional(),
  candidateId: z.string().optional(),
  terminatedAt: z.string().datetime().nullable().optional(),
});

const EmployeePatchDTO = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: DepartmentEnum.optional(),
  position: z.union([PositionEnum, z.null()]).optional(),
  notes: z.string().optional(),
  hiredAt: z.string().datetime().optional(),
  birthdayAt: z.string().datetime().nullable().optional(),
  terminatedAt: z.string().datetime().nullable().optional(),
});

// ---------- GET /employees ----------
employeesRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(+req.query.page! || 1, 1);
    const pageSize = Math.min(Math.max(+req.query.pageSize! || 50, 1), 200);
    const [items, total] = await Promise.all([
      Employee.find()
        .select("_id candidate fullName email phone department position notes hiredAt birthdayAt terminatedAt createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Employee.countDocuments(),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /employees ----------
employeesRouter.post("/", async (req, res, next) => {
  try {
    const body = EmployeeCreateDTO.parse(req.body);
    const email = normEmail(body.email);

    // Если явно передали candidateId — привяжем, иначе employee живёт сам по себе.
    let candidateId = body.candidateId || undefined;
    if (candidateId) {
      const cand = await Candidate.findById(candidateId).select({ _id: 1 }).lean();
      if (!cand) candidateId = undefined;
    }

    const now = new Date();
    now.setUTCHours(12, 0, 0, 0);

    const doc = await Employee.findOneAndUpdate(
      { email },
      {
        fullName: body.fullName.trim(),
        email,
        phone: body.phone?.trim() ?? "",
        department: body.department,
        position: body.position ?? null,
        notes: body.notes ?? "",
        birthdayAt: normalizeDateOnly(body.birthdayAt),
        hiredAt: body.hiredAt ? normalizeDateOnly(body.hiredAt)! : now,
        terminatedAt: normalizeDateOnly(body.terminatedAt),
        ...(candidateId ? { candidate: candidateId } : {}),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(doc);
  } catch (err: any) {
    if (err?.code === 11000) {
      const doc = await Employee.findOne({ email: normEmail(req.body?.email || "") }).lean();
      if (doc) return res.status(200).json(doc);
    }
    next(err);
  }
});

// ---------- PATCH /employees/:id ----------
employeesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = EmployeePatchDTO.parse(req.body);
    if (Object.keys(body).length === 0)
      return res.status(400).json({ error: "Empty body" });

    const update: any = {};
    if (body.fullName !== undefined) update.fullName = body.fullName.trim();
    if (body.email !== undefined) update.email = normEmail(body.email);
    if (body.phone !== undefined) update.phone = body.phone?.trim() ?? "";
    if (body.department !== undefined) update.department = body.department;
    if (body.position !== undefined) update.position = body.position ?? null;
    if (body.notes !== undefined) update.notes = body.notes ?? "";
    if (body.hiredAt !== undefined) update.hiredAt = normalizeDateOnly(body.hiredAt)!;
    if (body.birthdayAt !== undefined) update.birthdayAt = normalizeDateOnly(body.birthdayAt);
    if (body.terminatedAt !== undefined) update.terminatedAt = normalizeDateOnly(body.terminatedAt);

    const emp = await Employee.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
      context: "query",
    });
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    res.json(emp);
  } catch (err) {
    next(err);
  }
});