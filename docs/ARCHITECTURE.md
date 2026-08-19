# Architecture

## Request flow

```
Browser (client, :5173)
  │  multipart POST /api/analyze (resume PDF + jobDescription text)
  │  in dev, Vite proxies /api/* → http://localhost:3001
  ▼
Express server (server, :3001)
  │
  ├─ multer (memory storage) → raw PDF buffer
  ├─ pdfService.extractResumeText() → plain resume text
  ├─ claudeService.analyzeResumeAgainstJob(resumeText, jdText)
  │    → Anthropic Messages API, claude-sonnet-4-6
  │    → structured JSON via output_config.format (zodOutputFormat)
  │    → { matchScore, strengths[], gaps[], summary }
  ├─ supabaseService.saveAnalysis() → insert into `analyses` table
  ▼
Response: full analysis row → rendered as ScoreGauge + StrengthsGapsList
```

`GET /api/analyses` and `GET /api/analyses/:id` read straight from Supabase, no Claude involved.

## Why these choices

- **`client.messages.parse()` + `zodOutputFormat()` instead of prompting for JSON and parsing manually.** The brief's original plan was "ask Claude for JSON only, strip markdown fences before `JSON.parse`." The Anthropic SDK has a structured-outputs helper (`output_config.format`) that validates the response against a Zod schema server-side — same schema (`schemas.ts`) is reused for both the Claude call and (implicitly) the DB row shape. Removes an entire class of "Claude wrapped it in a code fence" bugs.
- **No router library on the client.** Only three views (Home, History, ResultDetail) with no deep-linking requirement in v1. Plain `useState` view-switching in `App.tsx` avoids adding `react-router-dom`, which wasn't in the agreed tech stack.
- **Vite dev proxy instead of a client-side API base URL env var.** Keeps local dev to zero client-side config. This does *not* carry over to production — see `DEPLOYMENT.md`, the client needs a real API base URL once it's not being served by the Vite dev server.
- **Anthropic errors are caught and rewritten in `claudeService.ts`**, not left to bubble up raw. Early testing surfaced a real bug: an unhandled `Anthropic.APIError` (e.g. the "credit balance too low" billing error) fell through to a generic 500 and leaked raw Anthropic error JSON to the client. Fixed by catching `Anthropic.APIError` specifically, logging the technical detail server-side, and returning a clean message to the client.

## Known gotcha: Supabase auto-enables RLS on new tables

`server/supabase/schema.sql` does not call `ENABLE ROW LEVEL SECURITY` — the brief explicitly wanted no auth/RLS for v1. But newer Supabase projects auto-enable RLS on every new table by default regardless of what SQL you run, which silently blocks all reads/writes via the anon key with a `42501` error. The schema now explicitly runs `alter table analyses disable row level security;` to counter this. If a fresh Supabase project starts throwing RLS errors again, that's why — Supabase's default may have changed again.

## File map

```
server/src/
  lib/          env validation, Supabase client, Anthropic client + model constant
  services/     pdfService (pdf-parse), claudeService (scoring), supabaseService (persistence)
  routes/       analyze.ts (POST), analyses.ts (GET list/detail)
  schemas.ts    Zod schema shared between the Claude structured-output call and request validation

client/src/
  lib/          api.ts (fetch wrappers), types.ts (shared with server's DB row shape, kept in sync by hand)
  components/   UploadForm, ScoreGauge (SVG ring), StrengthsGapsList, AnalysisResultView (composes the two)
  pages/        Home, History, ResultDetail
  App.tsx       view-state navigation + nav bar
```

## Data model

See `server/supabase/schema.sql` for the authoritative definition. `analyses`: one row per analysis run, no foreign keys, no auth — `resume_text`/`jd_text` stored in full so history detail views don't need to re-parse anything.
