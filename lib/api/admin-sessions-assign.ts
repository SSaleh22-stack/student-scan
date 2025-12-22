// POST /api/admin/sessions/:id/assign
// DELETE /api/admin/sessions/:id/assign

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireRole } from '../api-helpers';
import { queryOne, execute } from '../db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'ADMIN');
  if (!user) return;

  const sessionId = req.query.id as string;

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const { scanner_user_id } = z.object({ scanner_user_id: z.string() }).parse(body);

      const session = await queryOne<{ id: string }>('SELECT id FROM sessions WHERE id = $1', [sessionId]);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const scannerUser = await queryOne<{ id: string; role: string }>(
        'SELECT id, role FROM users WHERE id = $1',
        [scanner_user_id]
      );

      if (!scannerUser || scannerUser.role !== 'SCANNER') {
        return res.status(400).json({ error: 'Invalid scanner user' });
      }

      try {
        await execute(
          'INSERT INTO session_assignments (session_id, scanner_user_id) VALUES ($1, $2)',
          [sessionId, scanner_user_id]
        );
      } catch (error: any) {
        if (!error?.message?.includes('unique') && error?.code !== '23505') {
          throw error;
        }
      }

      return res.json({ message: 'Scanner assigned' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      return res.status(500).json({ error: 'Failed to assign scanner' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const body = req.body;
      const { scanner_user_id } = z.object({ scanner_user_id: z.string() }).parse(body);

      const session = await queryOne<{ id: string }>('SELECT id FROM sessions WHERE id = $1', [sessionId]);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      await execute(
        'DELETE FROM session_assignments WHERE session_id = $1 AND scanner_user_id = $2',
        [sessionId, scanner_user_id]
      );

      return res.json({ message: 'Scanner unassigned' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      return res.status(500).json({ error: 'Failed to unassign scanner' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

