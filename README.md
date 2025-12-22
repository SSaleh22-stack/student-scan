# student-scan

Attendance tracking web application with barcode scanning.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Vercel Serverless Functions
- **Database**: Neon PostgreSQL
- **Authentication**: JWT with HttpOnly cookies

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   ```bash
   export DATABASE_URL="your-neon-connection-string"
   export JWT_SECRET="your-secret-key"
   ```

3. Run database migration:
   ```bash
   npm run migrate
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Default Admin Account

- Username: `admin`
- Password: `admin123`

**Change the password after first login!**

## Deployment

Deploy to Vercel and add environment variables:
- `DATABASE_URL`
- `JWT_SECRET`
