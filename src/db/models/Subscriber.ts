// src/db/models/Subscriber.ts
import { Schema, model, InferSchemaType } from 'mongoose';

const subscriberSchema = new Schema({
  chatId:   { type: Number, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  firstName:{ type: String, default: '' },
  lastName: { type: String, default: '' },
}, { timestamps: true });

subscriberSchema.index({ createdAt: -1 });

export type SubscriberDoc = InferSchemaType<typeof subscriberSchema>;
export const Subscriber = model<SubscriberDoc>('Subscriber', subscriberSchema);