import mongoose from 'mongoose';

const SubscriberSchema = new mongoose.Schema(
  {
    chatId:   { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    firstName:{ type: String, default: '' },
    lastName: { type: String, default: '' },
    enabled:  { type: Boolean, default: true },
  },
  { collection: 'subscribers', timestamps: true }
);

export const Subscriber = mongoose.model('Subscriber', SubscriberSchema);