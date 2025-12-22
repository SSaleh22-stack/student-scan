# Restructure Git Repository

## Problem Identified

The git repository root is at `C:/Users/week8` (home directory), not in the project folder. This means:
- Files are stored as: `Desktop/student scanner/api/...` in GitHub
- Vercel sees: `Desktop/student scanner/api/[[...path]].js` (has space) ❌

## Solution: Restructure Repository

We need to initialize git in the project folder so files are at root level.

### Option 1: Reinitialize Git in Project Folder (Recommended)

**⚠️ WARNING: This will rewrite git history. Make sure you have a backup!**

1. **Backup current state:**
   ```powershell
   cd "C:\Users\week8\Desktop\student scanner"
   git branch backup-before-restructure
   git push origin backup-before-restructure
   ```

2. **Remove git tracking from parent:**
   ```powershell
   # We'll create a new .git in the project folder
   # The old one at C:/Users/week8/.git will be left alone
   ```

3. **Initialize new git repository in project folder:**
   ```powershell
   cd "C:\Users\week8\Desktop\student scanner"
   git init
   git remote add origin https://github.com/SSaleh22-stack/student-scan.git
   ```

4. **Add all files:**
   ```powershell
   git add .
   git commit -m "Restructure: Move repository root to project folder"
   ```

5. **Force push (this rewrites history):**
   ```powershell
   git push -f origin main
   ```

### Option 2: Use Git Filter-Repo (Advanced)

This preserves history but is more complex.

## After Restructuring

- Files will be stored as: `api/...` (no Desktop/student scanner prefix) ✅
- Vercel Root Directory can be set to `.` or empty ✅
- Function name will be: `api/[[...path]].js` ✅

## Current Status

Repository root: `C:/Users/week8`
Project folder: `C:/Users/week8/Desktop/student scanner`
Files in repo: `Desktop/student scanner/api/...`

## Target Status

Repository root: `C:/Users/week8/Desktop/student scanner`
Project folder: `C:/Users/week8/Desktop/student scanner`
Files in repo: `api/...`

