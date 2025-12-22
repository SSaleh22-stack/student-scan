# Fix Login 500 Errors

## The Problem

You're getting 500 errors on `/api/auth/login` and `/api/auth/me`. This is because **environment variables are not set in Vercel**.

## ✅ Solution: Add Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Select project: **student-scan**
3. Click **Settings** → **Environment Variables**

### Step 2: Add DATABASE_URL
- **Name:** `DATABASE_URL`
- **Value:** `postgresql://neondb_owner:npg_juU0cJavhtg1@ep-falling-thunder-agzjct0v-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

### Step 3: Add JWT_SECRET
- **Name:** `JWT_SECRET`
- **Value:** Any long random string (e.g., `my-super-secret-jwt-key-12345`)
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

### Step 4: Redeploy
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

### Step 5: Test Login
- Username: `admin`
- Password: `admin123`

## Why This Happens

The API routes need:
- `DATABASE_URL` - to connect to Neon database
- `JWT_SECRET` - to sign/verify JWT tokens

Without these, the server throws 500 errors.

## Check Logs

If errors persist after adding variables:
1. Go to **Deployments** → Click deployment → **Logs**
2. Look for error messages - they'll show what's wrong

## Fixed Issues

✅ Improved error handling - better error messages in logs
✅ Fixed Tailwind CSS - removed CDN, using PostCSS plugin
✅ Better database connection handling

