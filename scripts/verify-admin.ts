// Verify admin user exists

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function verifyAdmin() {
  try {
    const result = await sql('SELECT id, username, role, is_active FROM users WHERE username = $1', ['admin']);
    if (result && result.length > 0) {
      console.log('✅ Admin user found:');
      console.log(JSON.stringify(result[0], null, 2));
    } else {
      console.log('❌ Admin user not found');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyAdmin();


