# Fix Vercel Function Name Error

## Problem
Error: `A Serverless Function has an invalid name: "'Desktop/student scanner/api/[[...path]].js'". They must be less than 128 characters long and must not contain any space.`

## Solution

The issue is that Vercel is using the full path including "Desktop/student scanner" which contains a space.

### Option 1: Change Root Directory in Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Click on **Settings**
3. Go to **General** → **Root Directory**
4. Change it from `Desktop/student scanner` to just `.` (current directory) or leave it empty
5. Save and redeploy

### Option 2: If Root Directory Must Stay

If you need to keep the root directory as `Desktop/student scanner`, you can:

1. Rename the folder locally to remove the space (e.g., `student-scanner`)
2. Update the root directory in Vercel to match
3. Push the changes

## Current Configuration

- API route: `api/[[...path]].ts`
- This should resolve to: `api/[[...path]].js` (no spaces)
- The error suggests Vercel is prepending the root directory path

## After Fixing

Once you update the root directory setting, Vercel should:
- Use the correct function path: `api/[[...path]].js`
- No spaces in the function name
- Deployment should succeed

