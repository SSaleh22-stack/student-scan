# Setting Up Environment Variables

## For Local Development

### Option 1: Create `.env` file (Recommended)

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://neondb_owner:npg_juU0cJavhtg1@ep-falling-thunder-agzjct0v-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=your-secret-key-here
```

### Option 2: Set in PowerShell

```powershell
$env:DATABASE_URL="postgresql://neondb_owner:npg_juU0cJavhtg1@ep-falling-thunder-agzjct0v-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:JWT_SECRET="your-secret-key-here"
```

### Generate JWT Secret

Generate a secure random secret:

**Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Or use online tool:**
- https://www.random.org/strings/
- Generate 32+ character random string

## For Vercel Deployment

### Step 1: Go to Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select your project: `student-scan`
3. Click **Settings** → **Environment Variables**

### Step 2: Add DATABASE_URL

1. Click **Add New**
2. **Name**: `DATABASE_URL`
3. **Value**: `postgresql://neondb_owner:npg_juU0cJavhtg1@ep-falling-thunder-agzjct0v-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
4. **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### Step 3: Add JWT_SECRET

1. Click **Add New**
2. **Name**: `JWT_SECRET`
3. **Value**: Generate a random secret (see below)
4. **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### Generate JWT Secret for Vercel

**Option 1: Use PowerShell (Windows)**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Option 2: Use Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 3: Use online generator**
- https://www.random.org/strings/
- Length: 64 characters
- Character set: Alphanumeric

### Step 4: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic redeploy

## Verify Environment Variables

### Check in Vercel

1. Go to **Settings** → **Environment Variables**
2. You should see:
   - ✅ `DATABASE_URL`
   - ✅ `JWT_SECRET`

### Test Locally

```bash
# Check if variables are set
echo $env:DATABASE_URL
echo $env:JWT_SECRET

# Or test the app
npm run dev
```

## Important Notes

⚠️ **Security:**
- Never commit `.env` file to Git (it's in `.gitignore`)
- Keep your `DATABASE_URL` secret
- Use strong `JWT_SECRET` (32+ characters)
- Different secrets for production vs development

✅ **Best Practices:**
- Use different `JWT_SECRET` for each environment
- Rotate secrets periodically
- Don't share secrets in chat/email

