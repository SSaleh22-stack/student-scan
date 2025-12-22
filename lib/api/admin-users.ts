// GET /api/admin/users
// POST /api/admin/users

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireRole } from '../api-helpers';
import { hashPassword } from '../auth';
import { query, execute } from '../db';
import { randomUUID } from 'crypto';

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(4),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'ADMIN');
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const users = await query<{
        id: string;
        username: string;
        role: string;
        is_active: boolean;
        created_at: string;
      }>('SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at DESC');

      return res.json({
        users: users.map((u) => ({
          ...u,
          is_active: Boolean(u.is_active),
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to load users' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const { username, password } = createUserSchema.parse(body);

      const userId = randomUUID();
      const passwordHash = await hashPassword(password);

      await execute(
        'INSERT INTO users (id, username, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5)',
        [userId, username, passwordHash, 'SCANNER', true]
      );

      return res.json({
        id: userId,
        username,
        role: 'SCANNER',
        is_active: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      if (error instanceof Error && error.message.includes('unique')) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

