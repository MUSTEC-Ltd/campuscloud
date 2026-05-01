# Contributing

Thanks for helping build this project. This repo is intentionally lightweight, so the goal is to keep changes clear and easy to review.

## Getting Started
1. Read `README.md` and `docs/STARTER.md`.
2. Create local env files from the examples:
   - `frontend/.env.example` → `frontend/.env.local`
   - `backend/.env.example` → `backend/.env.local`
3. Install deps and run apps as needed.

## Branching
- Create a feature branch from `main`.
- Keep branches focused and small when possible.

## Commits
- Use clear, descriptive commit messages.
- Prefer one logical change per commit.
- Commit message format:
  - `feat: add user profile endpoint`
  - `fix: handle null session`
  - `refactor: simplify auth middleware`
  - `add: initial dashboard layout`
  - `docs: update setup steps`
  - `chore: update dependencies`
  - `test: add auth service tests`

## Code Style
- Follow the default linting rules of each app.
- Keep formatting consistent with existing files.

## Pull Requests
- Describe what changed and why.
- Include screenshots for UI changes when relevant.
- Note any new env vars or config updates.

## Database Changes
- Add new Supabase migrations under `database/migrations/`.
- Include notes about any new tables, RLS policies, or seed data.

## Questions
- If something is unclear, open a discussion or ask in the team channel.
