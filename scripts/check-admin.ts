// Check admin account in database

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  console.log('Please set DATABASE_URL in your .env file or environment variables');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function checkAdmin() {
  try {
    console.log('Checking admin account in database...\n');

    // Check if admin user exists
    const admin = await sql(
      'SELECT id, username, role, is_active, created_at FROM users WHERE username = $1',
      ['admin']
    );

    if (admin.length === 0) {
      console.log('❌ Admin account NOT FOUND in database');
      console.log('\nTo create the admin account, run: npm run migrate');
      return;
    }

    const adminUser = admin[0] as {
      id: string;
      username: string;
      role: string;
      is_active: boolean;
      created_at: string;
    };

    console.log('✅ Admin account found!\n');
    console.log('Account Details:');
    console.log('  Username:', adminUser.username);
    console.log('  Role:', adminUser.role);
    console.log('  Active:', adminUser.is_active ? 'Yes ✅' : 'No ❌');
    console.log('  User ID:', adminUser.id);
    console.log('  Created:', new Date(adminUser.created_at).toLocaleString());
    console.log('\nDefault Password: admin123');
    console.log('⚠️  Change this password after first login!');

    // Check total users
    const allUsers = await sql('SELECT COUNT(*) as count FROM users');
    console.log('\nTotal users in database:', allUsers[0]?.count || 0);

  } catch (error) {
    console.error('Error checking admin account:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
    }
    process.exit(1);
  }
}

checkAdmin();


