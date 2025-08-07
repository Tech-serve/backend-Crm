import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] connection error:', err);
  });
}