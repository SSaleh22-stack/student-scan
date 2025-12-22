# Debug 500 Errors - Step by Step

## Environment Variables Are Set ✅

You've confirmed that `DATABASE_URL` and `JWT_SECRET` are set in Vercel. But you're still getting 500 errors.

## Step 1: Check Vercel Deployment Logs

The logs will show the actual error:

1. Go to: https://vercel.com/dashboard
2. Select project: **student-scan**
3. Go to **Deployments** tab
4. Click on the **latest deployment**
5. Click **Logs** tab
6. Look for error messages (they'll be in red)

**What to look for:**
- Database connection errors
- Missing environment variable errors
- Import/module errors
- Function timeout errors

## Step 2: Test Database Connection

I've added a test endpoint. After redeploy, try:

```
GET https://your-vercel-url.vercel.app/api/test-db
```

This will show:
- If DATABASE_URL is set
- If database connection works
- The actual error if it fails

## Step 3: Common Issues

### Issue 1: Environment Variables Not Applied
- **Fix:** After adding variables, you MUST redeploy
- Go to Deployments → Click ⋯ → Redeploy

### Issue 2: Database Connection String Format
- **Check:** Make sure DATABASE_URL doesn't have extra quotes or spaces
- **Format:** `postgresql://user:pass@host/db?sslmode=require`

### Issue 3: Database Not Accessible from Vercel
- **Check:** Neon database might have IP restrictions
- **Fix:** Check Neon dashboard → Settings → IP Allowlist (should allow all or Vercel IPs)

### Issue 4: Request Body Parsing
- **Check:** Vercel might parse body differently
- **Fix:** I've added better body parsing in the code

## Step 4: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try to login
4. Click on the failed request (`/api/auth/login`)
5. Check:
   - **Request Payload** - is the body correct?
   - **Response** - what's the actual error message?

## Step 5: Verify Environment Variables

In Vercel:
1. Settings → Environment Variables
2. Make sure both variables show:
   - ✅ **All Environments** selected
   - ✅ Values are correct (no extra spaces/quotes)
   - ✅ Status shows as "Active"

## What I've Added

✅ Better error logging - errors now show in Vercel logs
✅ Environment variable check at start of handler
✅ Test endpoint: `/api/test-db`
✅ Better request body parsing
✅ More detailed error messages

## Next Steps

1. **Redeploy** after the latest code changes
2. **Check Vercel logs** for the actual error
3. **Test the database** endpoint: `/api/test-db`
4. **Share the error** from logs if it persists

The code now has much better error reporting, so the Vercel logs should show exactly what's wrong.

