-- 001_init.sql
-- Starter migration template for Supabase (Postgres)
-- Add real tables, types, and policies once the domain is defined.

-- Example extension (optional)
-- create extension if not exists "uuid-ossp";

-- Example table (placeholder)
-- create table if not exists public.profiles (
--   id uuid primary key default gen_random_uuid(),
--   created_at timestamptz not null default now(),
--   display_name text
-- );

-- Example RLS (placeholder)
-- alter table public.profiles enable row level security;
-- create policy "Profiles are viewable by users" on public.profiles
--   for select using (auth.uid() = id);
