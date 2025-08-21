import { Router } from "express";
import { z } from "zod";
import { Employee } from "../db/models/Employee";

export const employeesRouter = Router();

const DepartmentEnum = z.enum(["Gambling", "Sweeps", "Search", "Vitehi", "Tech", "TechaDeals", "Admin"]);
const PositionEnum = z.enum(["Head", "TeamLead", "Buyer", "Designer", "Accountant", "Administrator", "CTO", "Translator", "Frontend"]);

const EmployeePatchDTO = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: DepartmentEnum.optional(),
  position: z.union([PositionEnum, z.null()]).optional(),
  notes: z.string().optional(),
  hiredAt: z.string().datetime().optional(),
  birthdayAt: z.string().datetime().nullable().optional(),
});

employeesRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(+req.query.page! || 1, 1);
    const pageSize = Math.min(Math.max(+req.query.pageSize! || 50, 1), 200);
    const [items, total] = await Promise.all([
      Employee.find().sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Employee.countDocuments()
    ]);
    res.json({ page, pageSize, total, items });
  } catch (err) {
    next(err);
  }
});

employeesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = EmployeePatchDTO.parse(req.body);
    if (Object.keys(body).length === 0) return res.status(400).json({ error: "Empty body" });
    const emp = await Employee.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true, context: "query" });
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    res.json(emp);
  } catch (err) {
    next(err);
  }
});