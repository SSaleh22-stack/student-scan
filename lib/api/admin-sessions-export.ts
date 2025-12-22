// GET /api/admin/sessions/:id/export.csv

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
      scanned_student_number: string;
      scanned_at: string;
      scanned_by: string;
    }>(
      `SELECT sc.scanned_student_number, sc.scanned_at, u.username as scanned_by 
       FROM scans sc 
       LEFT JOIN users u ON sc.scanned_by_user_id = u.id 
       WHERE sc.session_id = $1 
       ORDER BY sc.scanned_at DESC`,
      [sessionId]
    );

    const headers = ['Student Number', 'Scanned At', 'Scanned By'];
    const rows = scans.map((s) => [
      s.scanned_student_number,
      s.scanned_at,
      s.scanned_by || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}-scans.csv"`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to export scans' });
  }
}

