-- Run this in the Supabase SQL editor (or via `supabase db push`) to create
-- the table this app reads and writes.

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  resume_text text not null,
  resume_filename text not null,
  jd_text text not null,
  match_score int not null check (match_score >= 0 and match_score <= 100),
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  summary text not null
);

create index if not exists analyses_created_at_idx on analyses (created_at desc);

-- New Supabase projects auto-enable RLS on new tables by default. This app
-- has no auth in v1, so explicitly disable it (the anon key is used server-side
-- as the only writer/reader) rather than leave the table silently locked.
alter table analyses disable row level security;

-- No RLS/auth in v1 (no login). To add auth later without a redesign:
--   1. add a `user_id uuid references auth.users(id)` column
--   2. alter table analyses enable row level security;
--   3. add policies scoped to auth.uid() = user_id
