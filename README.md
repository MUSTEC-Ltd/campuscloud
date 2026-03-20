# Project Starter

This repository is a lightweight starter for a **separate frontend + backend** architecture with **Supabase** as the database.
It is intentionally minimal so the team can fill in product details, UI, and services later.

## Repo Structure
- `frontend/` - React app (Vite)
- `backend/` - Next.js app (API + server)
- `database/` - Supabase resources, migrations, and schema notes
- `docs/` - Starter document and design notes
- `scripts/` - Utility scripts (optional)

## Quick Start (Local)
1. **Clone** the repository.
2. **Set up environment files**:
   - `frontend/.env.example` → copy to `frontend/.env.local`
   - `backend/.env.example` → copy to `backend/.env.local`
3. **Supabase**:
   - Use the Supabase project for this repo (TBD).
   - Add your Supabase URL and keys to the env files.
4. **Run Frontend**:
   - `cd frontend`
   - `npm install`
   - `npm run dev`
5. **Run Backend**:
   - `cd backend`
   - `npm install`
   - `npm run dev`

## Configuration Placeholders
- **Frontend**: API base URL, Supabase public keys
- **Backend**: Supabase service role key, DB connection, JWT config

## Notes
- The codebase is intentionally skeletal.
- Fill in the frontend and backend details as product decisions are finalized.
- See `docs/STARTER.md` for a concise setup overview.
