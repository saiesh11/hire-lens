-- Run this in the Supabase SQL editor (or via `supabase db push`) to create
-- the table this app reads and writes. Safe to re-run — every statement is
-- idempotent, so running it again against an already-migrated table is a
-- no-op for the new columns below.

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  resume_text text not null,
  resume_filename text not null,
  jd_text text not null,
  match_score int not null check (match_score >= 0 and match_score <= 100),
  recommendation text not null default 'possible_match',
  criteria jsonb not null default '[]'::jsonb,
  skills_matrix jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  interview_questions jsonb not null default '[]'::jsonb,
  summary text not null,
  user_id text
);

-- v2: structured scorecard columns, for tables created before this migration.
alter table analyses add column if not exists recommendation text not null default 'possible_match';
alter table analyses add column if not exists criteria jsonb not null default '[]'::jsonb;
alter table analyses add column if not exists skills_matrix jsonb not null default '[]'::jsonb;
alter table analyses add column if not exists interview_questions jsonb not null default '[]'::jsonb;
-- strengths/gaps are still jsonb arrays, but each element is now
-- {point, evidence} instead of a plain string — no column change needed.

-- Phase 0 (auth): Clerk user IDs are strings like "user_2abc..." — not
-- Postgres uuid. Nullable, not backfilled: rows created before auth existed
-- have no real owner, and stay invisible once every read/write is scoped by
-- user_id in application code (see supabaseService.ts) rather than deleted.
alter table analyses add column if not exists user_id text;
create index if not exists analyses_user_id_idx on analyses (user_id);

create index if not exists analyses_created_at_idx on analyses (created_at desc);

-- New Supabase projects auto-enable RLS on new tables by default. This app
-- has no client-side Supabase access — the anon key is used server-side only,
-- and every query is explicitly scoped by user_id in application code
-- (Clerk verifies identity in Express; see docs/ARCHITECTURE.md). RLS stays
-- off because Express is the enforcement point, not because there's no auth.
alter table analyses disable row level security;
