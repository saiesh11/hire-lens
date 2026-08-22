# HireLens

A multi-tenant recruiting platform: create a job, upload candidate resumes (PDF), and get back an AI-generated, evidence-grounded scorecard for each one — powered by Claude.

**🔗 Live demo: [hire-lens-lime-three.vercel.app](https://hire-lens-lime-three.vercel.app)**

Sign up (Google or email), create or join an organization, create a job by pasting a description, then upload a resume PDF to see it scored.

## What it does

- **Multi-tenant organizations** via Clerk — teams share the same jobs/candidates, admin vs. member roles (only admins can delete)
- **Structured AI scorecard per candidate** — overall match score, a weighted criteria breakdown (`required` vs. `preferred`), a present/partial/missing skills matrix, strengths and gaps each grounded in a specific quote from the resume/JD (not just an unexplained score), suggested interview questions, and a summary
- **Bulk resume upload** with per-file progress and retry — add many candidates to a job at once
- **Sorting and ranking** candidates within a job by score, recency, or recommendation
- **JD-staleness detection** — if a job description is edited after candidates were already scored, those candidates are flagged stale with a one-click manual re-analyze
- **GitHub profile enrichment** — auto-detected from a `github.com/...` link in the resume, or searched by the candidate's name with a human picking the right result (never auto-attributed — GitHub usernames and names aren't unique, so a wrong guess would be worse than no data)
- **Org-wide dashboard** — total jobs/candidates, average score, animated recommendation-split and score-distribution charts
- **Dark mode**, with every third-party component (including Clerk's own UI) themed to match

## Tech stack

- **Client** — React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts
- **Server** — Node.js, Express, TypeScript
- **Database + file storage** — Supabase (Postgres + Storage)
- **Auth** — Clerk (multi-tenant Organizations, admin/member roles)
- **AI** — Anthropic Claude API (`claude-sonnet-4-6`), structured JSON output validated with Zod
- **Hosting** — Vercel — the client (static build) and the Express server (as a single Vercel Function) deploy from one project, no separate backend host needed

## Project structure

```
hire-lens/
├── api/             Vercel Function entrypoint — re-exports the Express app
├── client/          React + Vite + TS + Tailwind + shadcn/ui
│   └── src/
│       ├── pages/       Dashboard, Jobs, JobDetail, CandidateDetail, Settings
│       ├── components/  scorecard views, GitHub enrichment, bulk upload
│       └── lib/         API client, client-side routing, page cache, types
├── server/          Node + Express + TS
│   ├── src/
│   │   ├── routes/      jobs, candidates, dashboard
│   │   ├── services/    Claude scoring, Supabase, GitHub enrichment, resume storage
│   │   └── lib/         env validation, Supabase / Clerk / Anthropic clients
│   └── supabase/schema.sql
└── docs/            ARCHITECTURE.md, DEPLOYMENT.md, ROADMAP.md
```

`client/` and `server/` are npm workspaces, installed together from the repo root.

## Running it locally

### 1. Accounts you'll need

- A [Supabase](https://supabase.com) project (Postgres + Storage)
- A [Clerk](https://clerk.com) application, with **Organizations** enabled (Clerk dashboard → Configure → Organizations) and **"Membership required"** turned on
- An [Anthropic](https://console.anthropic.com) API key

### 2. Set up Supabase

1. Create a project, then in **Project Settings → API** copy the **Project URL**, **anon public** key, and **service_role** key.
2. In the **SQL Editor**, run [`server/supabase/schema.sql`](server/supabase/schema.sql) — it's idempotent, safe to run more than once.

### 3. Install and configure

```bash
git clone https://github.com/saiesh11/hire-lens.git
cd hire-lens
npm install
```

Copy the example env files and fill them in:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env`:

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
GITHUB_TOKEN=        # optional — GitHub enrichment works without it, just rate-limited lower
PORT=3001
```

`client/.env`:

```
VITE_CLERK_PUBLISHABLE_KEY=
```

### 4. Run it

```bash
cd server && npm run dev    # http://localhost:3001
cd client && npm run dev    # http://localhost:5173 — proxies /api/* to the server
```

Run both at once, in separate terminals.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — request flow, the data model, and the reasoning behind every real design decision made along the way
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — how this is hosted on Vercel, including the real deploy issues hit and how they were diagnosed
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's shipped vs. what's left

## What's left

Everything on the original roadmap is done except one: migrating the AI layer from Claude to Google Gemini, deliberately scoped last.

Day-to-day development happens on `dev`; `master` is the production branch Vercel deploys from, merged into deliberately once a batch of work is verified working.
