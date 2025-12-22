// POST /api/auth/logout

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProduction = req.url?.includes('https://') || req.url?.includes('vercel.app');
  const secureFlag = isProduction ? 'Secure;' : '';
  res.setHeader('Set-Cookie', `session=; HttpOnly; ${secureFlag} SameSite=Lax; Path=/; Max-Age=0`);
  return res.json({ message: 'Logged out' });
}

