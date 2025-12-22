# How to Check Admin Account in Database

## Quick Check

Run this command (after setting DATABASE_URL):

```bash
npm run check-admin
```

## Step 1: Set DATABASE_URL

You need to set your Neon database connection string first.

### Option 1: Environment Variable (Temporary)
```powershell
# PowerShell
$env:DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

### Option 2: .env File (Permanent)
Create a `.env` file in the project root:
```
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
JWT_SECRET=your-secret-key
```

## Step 2: Run Check

```bash
npm run check-admin
```

## Expected Output

If admin account exists:
```
✅ Admin account found!

Account Details:
  Username: admin
  Role: ADMIN
  Active: Yes ✅
  User ID: 4ce45c31-c207-4a4a-a315-b9fff0d407e0
  Created: [date]

Default Password: admin123
⚠️  Change this password after first login!

Total users in database: 1
```

If admin account NOT found:
```
❌ Admin account NOT FOUND in database

To create the admin account, run: npm run migrate
```

## Create Admin Account

If the admin account doesn't exist, create it by running:

```bash
npm run migrate
```

This will:
1. Create all database tables
2. Create the default admin account
3. Set up indexes

## Admin Account Details

- **Username:** `admin`
- **Password:** `admin123`
- **Role:** `ADMIN`
- **Status:** Active

**⚠️ Important:** Change the password after first login!

