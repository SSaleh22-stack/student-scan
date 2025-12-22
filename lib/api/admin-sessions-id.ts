// PATCH /api/admin/sessions/:id

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireRole } from '../api-helpers';
import { queryOne, execute } from '../db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'ADMIN');
  if (!user) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query.id as string;
    const body = req.body;
    const { is_open } = z.object({ is_open: z.boolean().optional() }).parse(body);

    if (is_open !== undefined) {
      await execute('UPDATE sessions SET is_open = $1 WHERE id = $2', [is_open, sessionId]);
    }

    const session = await queryOne<{
      id: string;
      title: string;
      notes: string | null;
      created_by: string;
      created_at: string;
      is_open: boolean;
    }>('SELECT * FROM sessions WHERE id = $1', [sessionId]);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({
      ...session,
      is_open: Boolean(session.is_open),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to update session' });
  }
}

