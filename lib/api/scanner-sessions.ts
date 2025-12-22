// GET /api/scanner/sessions

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireRole } from '../api-helpers';
import { query } from '../db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'SCANNER');
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
       INNER JOIN session_assignments sa ON s.id = sa.session_id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE sa.scanner_user_id = $1 AND s.is_open = true
       ORDER BY s.created_at DESC`,
      [user.id]
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

