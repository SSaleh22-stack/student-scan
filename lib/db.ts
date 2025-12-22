// Neon database connection utility

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

// Helper function to execute raw SQL queries
// Neon uses PostgreSQL $1, $2, $3... placeholders
export async function query<T = any>(queryText: string, params?: any[]): Promise<T[]> {
  const result = await sql(queryText, params || []);
  return result as T[];
}

// Helper function to execute a single query
export async function queryOne<T = any>(queryText: string, params?: any[]): Promise<T | null> {
  const result = await query<T>(queryText, params);
  return result[0] || null;
}

// Helper function to execute a query that doesn't return results
export async function execute(queryText: string, params?: any[]): Promise<void> {
  await query(queryText, params);
}
