// GET /api/admin/sessions
// POST /api/admin/sessions

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireRole, getAuthUser } from '../api-helpers';
import { query, queryOne, execute } from '../db';
import { randomUUID } from 'crypto';

const createSessionSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'ADMIN');
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const sessions = await query<{
        id: string;
        title: string;
        notes: string | null;
        created_by: string;
        created_by_username: string;
        created_at: string;
        is_open: boolean;
      }>(
        `SELECT s.*, u.username as created_by_username 
         FROM sessions s 
         LEFT JOIN users u ON s.created_by = u.id 
         ORDER BY s.created_at DESC`
      );

      return res.json({
        sessions: sessions.map((s) => ({
          ...s,
          is_open: Boolean(s.is_open),
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to load sessions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const { title, notes } = createSessionSchema.parse(body);

      const sessionId = randomUUID();
      const authUser = await getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await execute(
        'INSERT INTO sessions (id, title, notes, created_by, is_open) VALUES ($1, $2, $3, $4, $5)',
        [sessionId, title, notes || null, authUser.id, true]
      );

      const session = await queryOne<{
        id: string;
        title: string;
        notes: string | null;
        created_by: string;
        created_at: string;
        is_open: boolean;
      }>('SELECT * FROM sessions WHERE id = $1', [sessionId]);

      return res.json({
        ...session,
        is_open: Boolean(session?.is_open),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      return res.status(500).json({ error: 'Failed to create session' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

