// GET /api/scanner/sessions/:id/scans

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireRole } from '../api-helpers';
import { queryOne, query } from '../db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'SCANNER');
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query.id as string;

    const assignment = await queryOne<{ id: string }>(
      `SELECT s.id 
       FROM sessions s
       INNER JOIN session_assignments sa ON s.id = sa.session_id
       WHERE s.id = $1 AND sa.scanner_user_id = $2`,
      [sessionId, user.id]
    );

    if (!assignment) {
      return res.status(403).json({ error: 'Session not assigned to you' });
    }

    const scans = await query<{
      id: string;
      session_id: string;
      scanned_student_number: string;
      scanned_by_user_id: string;
      scanned_at: string;
    }>('SELECT * FROM scans WHERE session_id = $1 ORDER BY scanned_at DESC LIMIT 100', [sessionId]);

    return res.json({
      scans: scans,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load scans' });
  }
}

