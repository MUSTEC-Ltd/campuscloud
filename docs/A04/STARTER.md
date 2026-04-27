# Starter Document

## Goal
Provide a minimal scaffold for a separate React frontend and Next.js backend, with Supabase as the database.

## Architecture (Initial Assumption)
- Frontend: React app (Vite)
- Backend: Next.js app (API routes + server)
- Database: Supabase project (PostgreSQL + Auth + Storage)

## Decisions Pending
- Deployment targets
- Auth strategy and roles
- Core domain models

## Setup Checklist
1. Create/confirm Supabase project.
2. Add required env vars in `frontend/.env.local` and `backend/.env.local`.
3. Add schema and migrations under `database/migrations/`.
4. Connect frontend to backend API.

## Environment Variables (Placeholders)
Frontend (Vite):
- `VITE_SUPABASE_URL=`
- `VITE_SUPABASE_ANON_KEY=`
- `VITE_API_BASE_URL=`

Backend (Next.js):
- `SUPABASE_URL=`
- `SUPABASE_SERVICE_ROLE_KEY=`
- `JWT_SECRET=`
- `PORT=3000`

## Supabase Migrations
- Place SQL migrations in `database/migrations/`.
- Start with `001_init.sql` and add incremental files.

## Next Steps
- Add basic API routes under `backend/src/app/api/`.
- Add a landing page in the frontend.
- Define tables and RLS policies.
