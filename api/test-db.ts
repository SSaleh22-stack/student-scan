// Test database connection
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne } from '../lib/db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
    
    const test = await queryOne('SELECT 1 as test');
    return res.json({ 
      success: true, 
      test,
      databaseUrlSet: !!process.env.DATABASE_URL 
    });
  } catch (error) {
    console.error('Database test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return res.status(500).json({ 
      success: false, 
      error: errorMessage,
      stack: errorStack,
      databaseUrlSet: !!process.env.DATABASE_URL
    });
  }
}

