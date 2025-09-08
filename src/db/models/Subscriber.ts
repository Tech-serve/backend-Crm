import { Schema, model } from 'mongoose';

const SubscriberSchema = new Schema(
  {
    chatId:   { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    firstName:{ type: String, default: '' },
    lastName: { type: String, default: '' },
    enabled:  { type: Boolean, default: true },
  },
  { collection: 'subscribers', timestamps: true }
);

export const Subscriber = model('Subscriber', SubscriberSchema);