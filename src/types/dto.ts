import { z } from 'zod';

export const CandidateCreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  notes: z.string().optional()
});
export type CandidateCreateDto = z.infer<typeof CandidateCreateSchema>;

export const INTERVIEW_STATUS_VALUES = [
  'not_held',
  'success',
  'declined',
  'canceled',
  'reserve',
] as const;
export type InterviewStatus = typeof INTERVIEW_STATUS_VALUES[number];

export const InterviewStatusEnum = z.enum(INTERVIEW_STATUS_VALUES);

const InterviewStatusInput = z
  .union([InterviewStatusEnum, z.literal('reject'), z.literal('rejected')])
  .transform(v => (v === 'reject' || v === 'rejected' ? 'declined' : v));

export const InterviewCreateSchema = z.object({
  candidateId: z.string().optional(),
  candidate: z.object({
    fullName: z.string().min(1),
    email: z.string().email()
  }).optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  participants: z.array(z.string().email()).optional(),
  meetLink: z.string().url().optional(),

  status: InterviewStatusInput.optional(),

  source: z.enum(['jira', 'crm']).optional(),
  notes: z.string().optional(),
  googleCalendarEventId: z.string().optional(),
  jiraIssueId: z.string().optional()
})
.refine((v) => !!v.candidateId || !!v.candidate, {
  message: 'Provide candidateId or candidate{fullName,email}'
});
export type InterviewCreateDto = z.infer<typeof InterviewCreateSchema>;

export const InterviewPatchSchema = z.object({
  status: InterviewStatusInput.optional(),

  notes: z.string().optional(),
  participants: z.array(z.string().email()).optional()
}).refine((v) => Object.keys(v).length > 0, {
  message: 'Nothing to update'
});
export type InterviewPatchDto = z.infer<typeof InterviewPatchSchema>; 