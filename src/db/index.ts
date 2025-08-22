import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 20000,
    heartbeatFrequencyMS: 10000,
  });

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] connection error:', err);
  });
}