// GET /api/admin/sessions/:id/scans

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

    const scans = await query<{
      id: string;
      session_id: string;
      scanned_student_number: string;
      scanned_by_user_id: string;
      scanned_by_username: string;
      scanned_at: string;
    }>(
      `SELECT sc.*, u.username as scanned_by_username 
       FROM scans sc 
       LEFT JOIN users u ON sc.scanned_by_user_id = u.id 
       WHERE sc.session_id = $1 
       ORDER BY sc.scanned_at DESC`,
      [sessionId]
    );

    return res.json({
      scans: scans,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load scans' });
  }
}

