// GET /api/auth/me

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../jwt';
import { queryOne } from '../db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookie = req.headers.cookie;
  if (!cookie) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const match = cookie.match(/session=([^;]+)/);
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = match[1];
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  const payload = await verifyToken(token, secret);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await queryOne<{
    id: string;
    username: string;
    role: string;
    is_active: boolean;
  }>(
    'SELECT id, username, role, is_active FROM users WHERE id = $1',
    [payload.userId]
  );

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
}

