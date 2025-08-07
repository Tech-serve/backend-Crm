import { Schema, model, InferSchemaType } from 'mongoose';

const userSchema = new Schema({
  googleId: { type: String, index: true },
  email: { type: String, required: true, unique: true, index: true },
  displayName: { type: String },
  avatarUrl: { type: String },
  role: { type: String, enum: ['admin', 'head', 'hr', 'buyer'], default: 'buyer' }
}, { timestamps: true });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);