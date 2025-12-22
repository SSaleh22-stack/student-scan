// POST /api/scanner/sessions/:id/scan

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireRole } from '../api-helpers';
import { queryOne, execute } from '../db';
import { randomUUID } from 'crypto';

const scanSchema = z.object({
  scanned_student_number: z.string().min(1),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireRole(req, res, 'SCANNER');
  if (!user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query.id as string;
    const body = req.body;
    const { scanned_student_number } = scanSchema.parse(body);

    const assignment = await queryOne<{ id: string; is_open: boolean }>(
      `SELECT s.id, s.is_open 
       FROM sessions s
       INNER JOIN session_assignments sa ON s.id = sa.session_id
       WHERE s.id = $1 AND sa.scanner_user_id = $2 AND s.is_open = true`,
      [sessionId, user.id]
    );

    if (!assignment) {
      return res.status(403).json({
        error: 'Session not found, not assigned to you, or closed',
      });
    }

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM scans WHERE session_id = $1 AND scanned_student_number = $2',
      [sessionId, scanned_student_number]
    );

    if (existing) {
      return res.status(409).json({
        error: 'Already scanned',
        scanned: true,
      });
    }

    const scanId = randomUUID();
    await execute(
      'INSERT INTO scans (id, session_id, scanned_student_number, scanned_by_user_id) VALUES ($1, $2, $3, $4)',
      [scanId, sessionId, scanned_student_number, user.id]
    );

    const scan = await queryOne<{
      id: string;
      session_id: string;
      scanned_student_number: string;
      scanned_by_user_id: string;
      scanned_at: string;
    }>('SELECT * FROM scans WHERE id = $1', [scanId]);

    return res.json({
      ...scan,
      scanned: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to record scan' });
  }
}

