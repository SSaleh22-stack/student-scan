# Vercel Environment Variables Setup

## ⚠️ Required for Login to Work

The 500 errors you're seeing are likely because **DATABASE_URL** and **JWT_SECRET** are not set in Vercel.

## Step 1: Go to Vercel Dashboard

1. Open: https://vercel.com/dashboard
2. Select your project: **student-scan**
3. Click **Settings** → **Environment Variables**

## Step 2: Add Environment Variables

Add these two variables:

### 1. DATABASE_URL
- **Name:** `DATABASE_URL`
- **Value:** `postgresql://neondb_owner:npg_juU0cJavhtg1@ep-falling-thunder-agzjct0v-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- **Environment:** Production, Preview, Development (select all)

### 2. JWT_SECRET
- **Name:** `JWT_SECRET`
- **Value:** (Generate a random secret, e.g., use: `openssl rand -hex 32`)
- **Environment:** Production, Preview, Development (select all)

**Example JWT_SECRET:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

## Step 3: Redeploy

After adding environment variables:

1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. OR push a new commit to trigger auto-deploy

## Step 4: Verify

After redeploy, try logging in again:
- Username: `admin`
- Password: `admin123`

The 500 errors should be resolved.

## Troubleshooting

If you still get 500 errors:

1. Check Vercel deployment logs:
   - Go to **Deployments** → Click on deployment → **Logs**
   - Look for error messages

2. Verify environment variables:
   - Settings → Environment Variables
   - Make sure both are set for all environments

3. Check database connection:
   - Make sure your Neon database is active
   - Verify the connection string is correct

