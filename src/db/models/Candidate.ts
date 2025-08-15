// backend/src/db/models/Candidate.ts
import { Schema, model, InferSchemaType, Types } from "mongoose";

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
    phone: { type: String, default: "" },
    notes: String,
    status: {
      type: String,
      enum: ["not_held", "success", "declined", "canceled", "reserve"],
      default: "not_held",
    },
    meetLink: String,
    department: {
      type: String,
      enum: ["Gambling", "Sweeps", "Search", "Vitehi", "Tech", "TechaDeals", "Admin"],
      default: "Gambling",
    },
    position: {
      type: String,
      enum: [
        "Head",
        "TeamLead",
        "Buyer",
        "Designer",
        "Accountant",
        "Administrator",
        "CTO",
        "Translator",
        "Frontend",
      ],
      default: null,
      set: (v: any) => (v === "" ? null : v),
    },
    polygraphAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    polygraphAddress: { type: String, default: "" },
    interviews: { type: [interviewSubSchema], default: [] },
  },
  { timestamps: true }
);

candidateSchema.index({ email: 1 });
candidateSchema.index({ fullName: 1 });

export type InterviewSubDoc = InferSchemaType<typeof interviewSubSchema>;
export type CandidateDaoc = InferSchemaType<typeof candidateSchema> & {
  interviews: Types.DocumentArray<InterviewSubDoc>;
};
export const Candidate = model("Candidate", candidateSchema);