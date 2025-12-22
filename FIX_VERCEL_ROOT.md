# Fix Vercel Function Name Error - Step by Step

## The Problem
Vercel is seeing: `Desktop/student scanner/api/[[...path]].js` (contains space)
But it should see: `api/[[...path]].js` (no space)

## Solution: Change Root Directory in Vercel

### Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Click on your project: **student-scan**

### Step 2: Open Settings
1. Click **Settings** tab (top menu)
2. Click **General** (left sidebar)

### Step 3: Find Root Directory
1. Scroll down to **Root Directory** section
2. You'll see it's currently set to: `Desktop/student scanner` (or similar)

### Step 4: Change Root Directory
1. **Clear the field** (make it empty) OR
2. Set it to: `.` (just a dot)
3. Click **Save**

### Step 5: Redeploy
1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. OR just push a new commit to trigger auto-deploy

## Why This Works

- **Before**: Root Directory = `Desktop/student scanner`
  - Function path: `Desktop/student scanner/api/[[...path]].js` ❌ (has space)
  
- **After**: Root Directory = `.` or empty
  - Function path: `api/[[...path]].js` ✅ (no space)

## Alternative: If Root Directory Must Stay

If you can't change the root directory, you need to:
1. Rename your local folder from `student scanner` to `student-scanner` (no space)
2. Update the Root Directory in Vercel to match: `Desktop/student-scanner`
3. Push changes to GitHub

## Verify It's Fixed

After redeploying, check the deployment logs. You should see:
- ✅ Function: `api/[[...path]].js` (no errors)
- ❌ NOT: `Desktop/student scanner/api/[[...path]].js`

