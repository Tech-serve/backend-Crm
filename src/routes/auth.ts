import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { findUserByEmail } from '../config/allowedUsers';
import { requireAuth } from '../middlewares/auth';

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
});

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'none' as const,    
    secure: true,                 
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

authRouter.post('/login', (req, res) => {
  const { email } = LoginSchema.parse(req.body);
  const found = findUserByEmail(email);
  if (!found) return res.status(401).json({ error: 'User not allowed' });

  const token = jwt.sign({ email: found.email, role: found.role }, env.JWT_SECRET, { expiresIn: '30d' });
  res
    .cookie('auth', token, cookieOpts())
    .json({ user: { email: found.email, role: found.role } });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('auth', cookieOpts()).json({ ok: true });
});