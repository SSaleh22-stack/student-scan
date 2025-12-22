// GET /api/admin/sessions/:id/assignments

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireRole } from '../api-helpers';
import { query } from '../db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'ADMIN');
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query.id as string;

    const assignments = await query<{
      scanner_user_id: string;
      username: string;
    }>(
      `SELECT sa.scanner_user_id, u.username 
       FROM session_assignments sa
       LEFT JOIN users u ON sa.scanner_user_id = u.id
       WHERE sa.session_id = $1`,
      [sessionId]
    );

    return res.json({
      assignments: assignments.map((a) => ({
        scanner_user_id: a.scanner_user_id,
        username: a.username,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load assignments' });
  }
}

