import { Schema, model, InferSchemaType, Types } from "mongoose";

/** ---- HR constants (англ. отделы + должности) ---- */
const DEPARTMENTS = [
  "Gambling",
  "Search",
  "AdminStaff",
  "Sweeps",
  "Tech",
] as const;
type Department = typeof DEPARTMENTS[number];

const POSITION_MAP: Record<Department, readonly string[]> = {
  Sweeps: ["Head", "TeamLead", "Buyer", "Designer"],
  Search: ["Head", "TeamLead", "Buyer", "Designer"],
  Gambling: ["Head", "TeamLead", "Buyer", "Designer"],
  AdminStaff: ["Accountant", "Administrator"],
  Tech: [],
} as const;

const ALL_POSITIONS = Array.from(
  new Set(Object.values(POSITION_MAP).flat())
) as readonly string[];
/** ----------------------------------------------- */

const interviewSubSchema = new Schema(
  {
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    participants: { type: [String], default: [] },
    meetLink: String,
    status: {
      type: String,
      enum: ["not_held", "success", "declined", "canceled", "reserve"],
      default: "not_held",
    },
    source: { type: String, enum: ["jira", "crm"], default: "crm" },
    googleCalendarEventId: String,
    jiraIssueId: String,
    notes: String,
  },
  { _id: false }
);

const candidateSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    notes: String,
    status: {
      type: String,
      enum: ["not_held", "success", "declined", "canceled", "reserve"],
      default: "not_held",
    },
    meetLink: String,
    department: {
      type: String,
      enum: DEPARTMENTS,
      default: "Gambling",
    },
    /** Новое поле — должность в рамках отдела */
    position: {
      type: String,
      enum: ALL_POSITIONS,
      validate: {
        validator: function (v: any) {
          if (!v) return true;
          const dep = (this as any).department as Department | undefined;
          if (!dep) return true;
          const allowed = POSITION_MAP[dep] || [];
          return allowed.includes(v);
        },
        message: "Invalid position for department",
      },
    },

    polygraphAt: { type: Date, default: null },
    acceptedAt:  { type: Date, default: null },
    declinedAt:  { type: Date, default: null },
    canceledAt:  { type: Date, default: null },
    polygraphAddress: { type: String, default: "" },

    interviews: { type: [interviewSubSchema], default: [] },
  },
  { timestamps: true }
);

candidateSchema.index({ email: 1 });
candidateSchema.index({ department: 1 });
candidateSchema.index({ position: 1 });
candidateSchema.index({ fullName: 1 });

export type InterviewSubDoc = InferSchemaType<typeof interviewSubSchema>;
export type CandidateDaoc = InferSchemaType<typeof candidateSchema> & {
  interviews: Types.DocumentArray<InterviewSubDoc>;
};
export const Candidate = model("Candidate", candidateSchema);