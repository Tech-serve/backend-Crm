import mongoose, { Schema, InferSchemaType, model } from "mongoose";

const CandidateSnapshotSchema = new Schema(
  {
    month: { type: Date, required: true, unique: true }, // 1-е число месяца в UTC
    counts: {
      not_held: { type: Number, default: 0 },
      reserve:  { type: Number, default: 0 }, // = Полиграф
      success:  { type: Number, default: 0 },
      declined: { type: Number, default: 0 },
      canceled: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

CandidateSnapshotSchema.index({ month: 1 }, { unique: true });

export type CandidateSnapshotDoc = InferSchemaType<typeof CandidateSnapshotSchema>;
export const CandidateSnapshot = model<CandidateSnapshotDoc>("CandidateSnapshot", CandidateSnapshotSchema);