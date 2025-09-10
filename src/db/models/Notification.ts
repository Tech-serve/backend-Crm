import mongoose, { Schema, Types } from 'mongoose';

type NotificationKind = 'meet_1h';

interface NotificationDoc {
  scope: string;
  candidateId: Types.ObjectId;
  scheduledAt: Date;
  kind: NotificationKind;
  createdAt: Date;
  expiresAt: Date;
}

const NotificationSchema = new Schema<NotificationDoc>(
  {
    scope: { type: String, default: 'crm', index: true },
    candidateId: { type: Schema.Types.ObjectId, required: true },
    scheduledAt: { type: Date, required: true },
    kind: { type: String, required: true, enum: ['meet_1h'] },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'notifications' }
);

NotificationSchema.index(
  { scope: 1, candidateId: 1, scheduledAt: 1, kind: 1 },
  { unique: true }
);

NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model<NotificationDoc>('Notification', NotificationSchema);