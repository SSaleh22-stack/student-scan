// POST /api/auth/login

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { verifyPassword } from '../auth';
import { generateToken } from '../jwt';
import { queryOne } from '../db';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const { username, password } = loginSchema.parse(body);

    const user = await queryOne<{
      id: string;
      username: string;
      password_hash: string;
      role: string;
      is_active: boolean;
    }>('SELECT * FROM users WHERE username = $1', [username]);

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    const token = await generateToken(
      { userId: user.id, role: user.role },
      secret
    );

    const isProduction = req.url?.includes('https://') || req.url?.includes('vercel.app');
    const secureFlag = isProduction ? 'Secure;' : '';
    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; ${secureFlag} SameSite=Lax; Path=/; Max-Age=86400`);

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Login failed', details: errorMessage });
  }
}

