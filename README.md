# HireLens

Upload a resume (PDF) and a job description, and get back an AI-generated match score with explained strengths, gaps, and a summary — powered by Claude.

## Stack

- **Client:** React + Vite + TypeScript + Tailwind CSS
- **Server:** Node.js + Express + TypeScript
- **Database:** PostgreSQL via Supabase
- **AI:** Claude API (`claude-sonnet-4-6`), structured JSON output via Zod
- **PDF parsing:** `pdf-parse`

## Project structure

```
hire-lens/
├── client/          React + Vite + TS + Tailwind
│   └── src/
│       ├── pages/       Home, History, ResultDetail
│       ├── components/  UploadForm, ScoreGauge, StrengthsGapsList, AnalysisResultView
│       └── lib/         api client, shared types
└── server/          Node + Express + TS
    ├── src/
    │   ├── routes/      analyze.ts, analyses.ts
    │   ├── services/    claudeService.ts, pdfService.ts, supabaseService.ts
    │   └── lib/         env, supabase client, claude client
    └── supabase/schema.sql   run this once in the Supabase SQL editor
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
3. In the **SQL Editor**, run [`server/supabase/schema.sql`](server/supabase/schema.sql) to create the `analyses` table.

### 2. Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com) → **API Keys**.

### 3. Server

```bash
cd server
npm install
cp .env.example .env   # then fill in the values below
npm run dev             # starts on http://localhost:3001
```

`server/.env`:

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
PORT=3001
```

### 4. Client

```bash
cd client
npm install
npm run dev              # starts on http://localhost:5173
```

The client dev server proxies `/api/*` to `http://localhost:3001`, so no client-side env var is needed. Run both `server` and `client` dev servers at the same time.

## API

- `POST /api/analyze` — multipart form (`resume`: PDF file, `jobDescription`: text) → saved analysis
- `GET /api/analyses` — list of past analyses (id, created_at, resume_filename, match_score)
- `GET /api/analyses/:id` — full analysis detail

## Scope (v1)

No auth, no multi-resume comparison, no resume builder, no payments. Single-user, single-flow: upload → analyze → view → history.
