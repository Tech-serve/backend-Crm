import { Schema, model } from 'mongoose';

const SubscriberSchema = new Schema({
  chatId:     { type: Number, required: true, unique: true },
  username:   { type: String },
  firstName:  { type: String },
  lastName:   { type: String },
  enabled:    { type: Boolean, default: true },
  createdAt:  { type: Date, default: Date.now },
});

export const Subscriber = model('Subscriber', SubscriberSchema);