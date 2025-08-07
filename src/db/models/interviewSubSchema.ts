import { Schema } from 'mongoose';

export const STATUS = ['not_held','success','declined','canceled','reserve'] as const;
export const LEGACY = ['reject','rejected'] as const;

export const interviewSubSchema = new Schema({
  scheduledAt:       { type: Date,   required: true, index: true },
  durationMinutes:   { type: Number, default: 60 },
  participants:      [{ type: String, index: true }],
  meetLink:          { type: String },
  status:            { type: String, enum: [...STATUS, ...LEGACY], default: 'not_held', index: true },
  source:            { type: String, enum: ['jira','crm'], default: 'jira' },
  googleCalendarEventId: { type: String },
  jiraIssueId:       { type: String },
  notes:             { type: String },
}, { _id: true, timestamps: true });

interviewSubSchema.pre('validate', function(next){
  if (this.isModified('status') && this.status) {
    // @ts-ignore
    if (this.status === 'reject' || this.status === 'rejected') this.status = 'declined';
  }
  next();
});