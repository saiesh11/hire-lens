-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Safe to re-run: table/column creation is idempotent, and the one-time
-- migration below is self-disabling (see the `analyses` existence check).

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  created_at timestamptz not null default now(),
  title text not null,
  jd_text text not null
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  resume_text text not null,
  resume_filename text not null,
  match_score int not null check (match_score >= 0 and match_score <= 100),
  recommendation text not null default 'possible_match',
  criteria jsonb not null default '[]'::jsonb,
  skills_matrix jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  interview_questions jsonb not null default '[]'::jsonb,
  summary text not null
);

create index if not exists jobs_user_id_idx on jobs (user_id);
create index if not exists jobs_created_at_idx on jobs (created_at desc);
create index if not exists candidates_job_id_idx on candidates (job_id);
create index if not exists candidates_user_id_idx on candidates (user_id);

-- New Supabase projects auto-enable RLS on new tables by default. This app
-- has no client-side Supabase access — the anon key is used server-side only,
-- and every query is explicitly scoped by user_id in application code
-- (Clerk verifies identity in Express; see docs/ARCHITECTURE.md). RLS stays
-- off because Express is the enforcement point, not because there's no auth.
alter table jobs disable row level security;
alter table candidates disable row level security;

-- Phase 2 one-time migration: analyses -> jobs + candidates. Each analyses
-- row (with a real user_id — pre-auth rows have none and are skipped, same
-- as they already were) becomes its own one-off Job with one Candidate.
-- Guarded by the `analyses` table's existence, so this is a no-op on every
-- run after the first: once migrated, `analyses` is renamed to
-- `analyses_legacy` below and this block is skipped from then on.
do $$
begin
  if to_regclass('public.analyses') is not null then
    with new_jobs as (
      insert into jobs (user_id, title, jd_text, created_at)
      select
        user_id,
        case when length(jd_text) > 60 then left(jd_text, 60) || '…' else jd_text end,
        jd_text,
        created_at
      from analyses
      where user_id is not null
      returning id, user_id, jd_text, created_at
    )
    insert into candidates (
      job_id, user_id, resume_text, resume_filename, match_score, recommendation,
      criteria, skills_matrix, strengths, gaps, interview_questions, summary, created_at
    )
    select
      nj.id, a.user_id, a.resume_text, a.resume_filename, a.match_score, a.recommendation,
      a.criteria, a.skills_matrix, a.strengths, a.gaps, a.interview_questions, a.summary, a.created_at
    from analyses a
    join new_jobs nj
      on nj.user_id = a.user_id and nj.jd_text = a.jd_text and nj.created_at = a.created_at
    where a.user_id is not null;

    alter table analyses rename to analyses_legacy;
  end if;
end $$;

-- Phase 4 addendum: JD staleness + manual re-analyze. Order matters here —
-- `now()` is evaluated once per statement, not once per row, so jobs must be
-- stamped before candidates or every pre-existing candidate would look stale
-- the instant this migration runs (scored_at would be later than
-- jd_updated_at for every row).
alter table jobs add column if not exists jd_updated_at timestamptz not null default now();
alter table candidates add column if not exists scored_at timestamptz not null default now();
alter table candidates add column if not exists resume_storage_path text;

-- Private bucket for original resume PDFs, so manual re-analyze can re-score
-- from the actual PDF (Claude reads PDFs natively) instead of the lossier
-- pdf-parse text kept only for display. No storage.objects RLS policies are
-- needed — this bucket is only ever touched by the service-role client
-- (see lib/supabaseAdmin.ts), which bypasses RLS entirely.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Phase 5: organization settings + permissions. jobs/candidates move from
-- user_id-scoped to org_id-scoped (user_id is kept, but its meaning shifts
-- to "creator" for attribution only — no longer used for query scoping).
-- org_id can't be not null immediately: existing rows have no org until
-- scripts/backfillOrganizations.ts creates one per existing user and
-- populates it, which requires calling the Clerk API, not just SQL. The
-- not-null enforcement below is self-guarding so this file stays safe to
-- run in one shot at any time — a no-op until every row has an org_id, then
-- automatically enforced on a later re-run, with no manual step-ordering
-- required.
alter table jobs add column if not exists org_id text;
alter table candidates add column if not exists org_id text;
create index if not exists jobs_org_id_idx on jobs (org_id);
create index if not exists candidates_org_id_idx on candidates (org_id);

do $$
begin
  if not exists (select 1 from jobs where org_id is null)
     and not exists (select 1 from candidates where org_id is null) then
    alter table jobs alter column org_id set not null;
    alter table candidates alter column org_id set not null;
  end if;
end $$;

-- Phase 6: GitHub profile enrichment. Additive and fully nullable — most
-- candidates won't have a detectable GitHub link, and old candidates simply
-- have no enrichment, no backfill needed.
alter table candidates add column if not exists github_username text;
alter table candidates add column if not exists github_enrichment jsonb;
alter table candidates add column if not exists github_fetched_at timestamptz;

-- Phase 6 addendum: candidate name, captured by Claude as part of the same
-- scoring call (no extra API request) so GitHub search-by-name has a name to
-- search with. Nullable — candidates that predate this get backfilled the
-- next time they're re-analyzed.
alter table candidates add column if not exists candidate_name text;
