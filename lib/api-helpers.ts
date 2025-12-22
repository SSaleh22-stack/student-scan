// Helper functions for API routes

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from './jwt';
import { queryOne } from './db';

export type User = {
  id: string;
  username: string;
  role: string;
};

// Get authenticated user from request
export async function getAuthUser(req: VercelRequest): Promise<User | null> {
  const cookie = req.headers.cookie;
  if (!cookie) {
    return null;
  }

  const match = cookie.match(/session=([^;]+)/);
  if (!match) {
    return null;
  }

  const token = match[1];
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  const payload = await verifyToken(token, secret);

  if (!payload) {
    return null;
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
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

// Require authentication middleware
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<User | null> {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

// Require specific role
export async function requireRole(
  req: VercelRequest,
  res: VercelResponse,
  role: 'ADMIN' | 'SCANNER'
): Promise<User | null> {
  const user = await requireAuth(req, res);
  if (!user) {
    return null;
  }
  if (user.role !== role) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}
