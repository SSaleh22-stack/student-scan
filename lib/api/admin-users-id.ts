// PATCH /api/admin/users/:id

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireRole } from '../api-helpers';
import { hashPassword } from '../auth';
import { queryOne, execute } from '../db';

const updateUserSchema = z.object({
  is_active: z.boolean().optional(),
  password: z.string().min(4).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'ADMIN');
  if (!user) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.query.id as string;
    const body = req.body;
    const data = updateUserSchema.parse(body);

    const existingUser = await queryOne<{
      id: string;
      username: string;
      role: string;
      is_active: boolean;
    }>('SELECT id, username, role, is_active FROM users WHERE id = $1', [userId]);

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (data.is_active !== undefined && existingUser.role === 'ADMIN' && !data.is_active) {
      return res.status(400).json({ error: 'Cannot disable admin account' });
    }

    if (data.password !== undefined) {
      const passwordHash = await hashPassword(data.password);
      await execute('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    }

    if (data.is_active !== undefined) {
      await execute('UPDATE users SET is_active = $1 WHERE id = $2', [data.is_active, userId]);
    }

    const updatedUser = await queryOne<{
      id: string;
      username: string;
      role: string;
      is_active: boolean;
    }>('SELECT id, username, role, is_active FROM users WHERE id = $1', [userId]);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      ...updatedUser,
      is_active: Boolean(updatedUser.is_active),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

