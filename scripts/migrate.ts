// Database migration script for Neon PostgreSQL

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    const migrationPath = join(process.cwd(), 'migrations', '0001_initial_schema_postgres.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split SQL into individual statements
    // Remove line comments first, then split by semicolons
    const lines = migrationSQL.split('\n');
    const cleanedLines = lines
      .map(line => {
        // Remove inline comments (-- comments)
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex).trim();
        }
        return line.trim();
      })
      .filter(line => line.length > 0);
    
    // Split by semicolon, but keep multi-line statements together
    const statements: string[] = [];
    let currentStatement = '';
    
    for (const line of cleanedLines) {
      currentStatement += line + '\n';
      if (line.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt.length > 1) { // More than just a semicolon
          statements.push(stmt.slice(0, -1)); // Remove trailing semicolon
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`Running ${statements.length} migration statements...`);
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await sql(statement);
        } catch (error: any) {
          // Ignore "already exists" errors for CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS
          if (error?.code === '42P07' || error?.code === '42710' || error?.message?.includes('already exists')) {
            console.log(`  (Already exists, skipping)`);
          } else if (error?.code === '23505' && statement.includes('INSERT')) {
            // Unique constraint violation (user already exists)
            console.log(`  (User already exists, skipping)`);
          } else {
            console.error(`  Error: ${error.message}`);
            throw error;
          }
        }
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

