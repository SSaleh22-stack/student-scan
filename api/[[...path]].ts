// Unified API handler for all routes
// This reduces the number of serverless functions to 1

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireRole, getAuthUser } from '../lib/api-helpers.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { generateToken, verifyToken } from '../lib/jwt.js';
import { query, queryOne, execute } from '../lib/db.js';
import { randomUUID } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Log environment check (remove in production if needed)
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error', 
      details: 'DATABASE_URL environment variable is not set. Please configure it in Vercel settings.' 
    });
  }

  const pathArray = (req.query.path as string[]) || [];
  const route = pathArray.join('/');

  // Auth routes
  if (route === 'auth/login' && req.method === 'POST') {
    const loginSchema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    });

    try {
      const body = req.body;
      const { username, password } = loginSchema.parse(body);

      const user = await queryOne<{
        id: string;
        username: string;
        password_hash: string;
        role: string;
        is_active: boolean;
      }>('SELECT * FROM users WHERE username = $1', [username]);

      console.log('User found:', !!user);

      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
      const token = await generateToken({ userId: user.id, role: user.role }, secret);

      const isProduction = req.url?.includes('https://') || req.url?.includes('vercel.app');
      const secureFlag = isProduction ? 'Secure;' : '';
      res.setHeader('Set-Cookie', `session=${token}; HttpOnly; ${secureFlag} SameSite=Lax; Path=/; Max-Age=86400`);

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ error: 'Login failed', details: errorMessage });
    }
  }

  if (route === 'auth/logout' && req.method === 'POST') {
    const isProduction = req.url?.includes('https://') || req.url?.includes('vercel.app');
    const secureFlag = isProduction ? 'Secure;' : '';
    res.setHeader('Set-Cookie', `session=; HttpOnly; ${secureFlag} SameSite=Lax; Path=/; Max-Age=0`);
    return res.json({ message: 'Logged out' });
  }

  if (route === 'auth/me' && req.method === 'GET') {
    try {
      const cookie = req.headers.cookie;
      if (!cookie) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const match = cookie.match(/session=([^;]+)/);
      if (!match) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = match[1];
      const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
      const payload = await verifyToken(token, secret);

      if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const user = await queryOne<{
        id: string;
        username: string;
        role: string;
        is_active: boolean;
      }>('SELECT id, username, role, is_active FROM users WHERE id = $1', [payload.userId]);

      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Auth/me error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      return res.status(500).json({ 
        error: 'Failed to get user', 
        details: errorMessage,
        errorType: errorName
      });
    }
  }

  // Admin routes - require ADMIN role
  if (path[0] === 'admin') {
    const adminUser = await requireRole(req, res, 'ADMIN');
    if (!adminUser) return;

    // GET /api/admin/users
    if (route === 'admin/users' && req.method === 'GET') {
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

    // POST /api/admin/users
    if (route === 'admin/users' && req.method === 'POST') {
      try {
        const body = req.body;
        const { username, password } = z.object({
          username: z.string().min(1),
          password: z.string().min(4),
        }).parse(body);

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

    // PATCH /api/admin/users/:id
    if (path[1] === 'users' && path[2] && req.method === 'PATCH') {
      try {
        const userId = path[2];
        const body = req.body;
        const data = z.object({
          is_active: z.boolean().optional(),
          password: z.string().min(4).optional(),
        }).parse(body);

        const existingUser = await queryOne<{
          id: string;
          username: string;
          role: string;
          is_active: boolean;
        }>('SELECT id, username, role, is_active FROM users WHERE id = $1', [userId]);

        if (!existingUser) {
          return res.status(404).json({ error: 'User not found' });
        }

        if (data.is_active !== undefined && existingUser.role === 'ADMIN' && !data.is_active) {
          return res.status(400).json({ error: 'Cannot disable admin account' });
        }

        if (data.password !== undefined) {
          const passwordHash = await hashPassword(data.password);
          await execute('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
        }

        if (data.is_active !== undefined) {
          await execute('UPDATE users SET is_active = $1 WHERE id = $2', [data.is_active, userId]);
        }

        const updatedUser = await queryOne<{
          id: string;
          username: string;
          role: string;
          is_active: boolean;
        }>('SELECT id, username, role, is_active FROM users WHERE id = $1', [userId]);

        return res.json({
          ...updatedUser,
          is_active: Boolean(updatedUser?.is_active),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return res.status(500).json({ error: 'Failed to update user' });
      }
    }

    // GET /api/admin/sessions
    if (route === 'admin/sessions' && req.method === 'GET') {
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

    // POST /api/admin/sessions
    if (route === 'admin/sessions' && req.method === 'POST') {
      try {
        const body = req.body;
        const { title, notes } = z.object({
          title: z.string().min(1),
          notes: z.string().optional(),
        }).parse(body);

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

    // PATCH /api/admin/sessions/:id
    if (path[1] === 'sessions' && path[2] && !path[3] && req.method === 'PATCH') {
      try {
        const sessionId = path[2];
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

    // POST /api/admin/sessions/:id/assign
    if (path[1] === 'sessions' && path[2] && path[3] === 'assign' && req.method === 'POST') {
      try {
        const sessionId = path[2];
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

    // DELETE /api/admin/sessions/:id/assign
    if (path[1] === 'sessions' && path[2] && path[3] === 'assign' && req.method === 'DELETE') {
      try {
        const sessionId = path[2];
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

    // GET /api/admin/sessions/:id/assignments
    if (path[1] === 'sessions' && path[2] && path[3] === 'assignments' && req.method === 'GET') {
      try {
        const sessionId = path[2];

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

    // GET /api/admin/sessions/:id/scans
    if (path[1] === 'sessions' && path[2] && path[3] === 'scans' && req.method === 'GET') {
      try {
        const sessionId = path[2];

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

    // GET /api/admin/sessions/:id/export.csv
    if (path[1] === 'sessions' && path[2] && path[3] === 'export.csv' && req.method === 'GET') {
      try {
        const sessionId = path[2];

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
  }

  // Scanner routes - require SCANNER role
  if (path[0] === 'scanner') {
    const scannerUser = await requireRole(req, res, 'SCANNER');
    if (!scannerUser) return;

    // GET /api/scanner/sessions
    if (route === 'scanner/sessions' && req.method === 'GET') {
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
          [scannerUser.id]
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

    // POST /api/scanner/sessions/:id/scan
    if (path[1] === 'sessions' && path[2] && path[3] === 'scan' && req.method === 'POST') {
      try {
        const sessionId = path[2];
        const body = req.body;
        const { scanned_student_number } = z.object({
          scanned_student_number: z.string().min(1),
        }).parse(body);

        const assignment = await queryOne<{ id: string; is_open: boolean }>(
          `SELECT s.id, s.is_open 
           FROM sessions s
           INNER JOIN session_assignments sa ON s.id = sa.session_id
           WHERE s.id = $1 AND sa.scanner_user_id = $2 AND s.is_open = true`,
          [sessionId, scannerUser.id]
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
          [scanId, sessionId, scanned_student_number, scannerUser.id]
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

    // GET /api/scanner/sessions/:id/scans
    if (path[1] === 'sessions' && path[2] && path[3] === 'scans' && req.method === 'GET') {
      try {
        const sessionId = path[2];

        const assignment = await queryOne<{ id: string }>(
          `SELECT s.id 
           FROM sessions s
           INNER JOIN session_assignments sa ON s.id = sa.session_id
           WHERE s.id = $1 AND sa.scanner_user_id = $2`,
          [sessionId, scannerUser.id]
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
  }

  return res.status(404).json({ error: 'Not found' });
}
