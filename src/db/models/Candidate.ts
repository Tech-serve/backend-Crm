import { Schema, model, InferSchemaType, Types } from 'mongoose';

/* -------- под-схема интервью (храним историю) ---------- */
const interviewSubSchema = new Schema(
  {
    scheduledAt:     { type: Date,   required: true },
    durationMinutes: { type: Number, default: 60 },
    participants:    { type: [String], default: [] },
    meetLink:        { type: String },
    status:          { type: String, enum: ['not_held','success','declined','canceled','reserve'], default: 'not_held' },
    source:          { type: String, enum: ['jira','crm'], default: 'crm' },
    googleCalendarEventId: String,
    jiraIssueId:     String,
    notes:           String,
  },
  { _id: false }
);

const candidateSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    notes:    { type: String },

    status:   { type: String, enum: ['not_held','success','declined','canceled','reserve'], default: 'not_held' },
    meetLink: { type: String },

    interviews: { type: [interviewSubSchema], default: [] },
  },
  { timestamps: true }
);

candidateSchema.index({ email: 1 });
candidateSchema.index({ fullName: 1 });

export type InterviewSubDoc = InferSchemaType<typeof interviewSubSchema>;
export type CandidateDoc   = InferSchemaType<typeof candidateSchema> & {
  interviews: Types.DocumentArray<InterviewSubDoc>;
};

export const Candidate = model('Candidate', candidateSchema);