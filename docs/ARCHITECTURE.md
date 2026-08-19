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
  ├─ (parallel) claudeService.analyzeResumeAgainstJob(pdfBuffer, jdText)
  │    → Anthropic Messages API, claude-sonnet-4-6, PDF sent as a native
  │      `document` content block — Claude reads the PDF directly, no
  │      text-extraction step in between
  │    → structured JSON via output_config.format (zodOutputFormat)
  │    → { matchScore, recommendation, criteria[], skillsMatrix[],
  │        strengths[], gaps[], interviewQuestions[], summary }
  ├─ (parallel) pdfService.extractResumeText() → plain text, best-effort,
  │    only used for the stored resume_text field — failure here is
  │    logged and falls back to "", it does not fail the request
  ├─ supabaseService.saveAnalysis() → insert into `analyses` table
  ▼
Response: full analysis row → rendered as ScoreGauge, RecommendationBadge,
CriteriaBreakdown, SkillsMatrixTable, StrengthsGapsList, InterviewQuestions
```

`GET /api/analyses` and `GET /api/analyses/:id` read straight from Supabase, no Claude involved.

## Auth (Phase 0 of the SaaS rebuild)

Clerk verifies identity; Express stays the sole trust boundary — the client never talks to Supabase directly, it only ever calls this Express API, so there was no reason to stand up Supabase's separate Clerk↔JWT third-party-auth bridge or per-row RLS policies. The pattern:

- `clerkMiddleware()` runs globally in `server/src/index.ts`, attaching the verified session to every request.
- Each protected route reads `getAuth(req).userId` directly (not the deprecated `requireAuth()` — that redirects to a sign-in page, which doesn't make sense for a JSON API; a plain `401` is correct here) and 401s if there's no signed-in user.
- Every `supabaseService.ts` function takes a `userId` and adds `.eq('user_id', userId)` — the multi-tenant boundary is enforced in application code, not the database.
- On the client, `lib/api.ts`'s fetch wrappers became a `useApi()` hook (Clerk's `getToken()` is only available inside components under `<ClerkProvider>`) that attaches `Authorization: Bearer <token>` to every request.
- `analyses.user_id` is a nullable `text` column (Clerk IDs are strings like `user_2abc...`, not `uuid`) — pre-auth rows have no owner and were left alone rather than backfilled; they're simply invisible now that every query is user-scoped.

## Why these choices

- **`client.messages.parse()` + `zodOutputFormat()` instead of prompting for JSON and parsing manually.** The brief's original plan was "ask Claude for JSON only, strip markdown fences before `JSON.parse`." The Anthropic SDK has a structured-outputs helper (`output_config.format`) that validates the response against a Zod schema server-side — same schema (`schemas.ts`) is reused for both the Claude call and (implicitly) the DB row shape. Removes an entire class of "Claude wrapped it in a code fence" bugs.
- **No router library on the client.** Only three views (Home, History, ResultDetail) with no deep-linking requirement in v1. Plain `useState` view-switching in `App.tsx` avoids adding `react-router-dom`, which wasn't in the agreed tech stack.
- **Vite dev proxy instead of a client-side API base URL env var.** Keeps local dev to zero client-side config. This does *not* carry over to production — see `DEPLOYMENT.md`, the client needs a real API base URL once it's not being served by the Vite dev server.
- **Anthropic errors are caught and rewritten in `claudeService.ts`**, not left to bubble up raw. Early testing surfaced a real bug: an unhandled `Anthropic.APIError` (e.g. the "credit balance too low" billing error) fell through to a generic 500 and leaked raw Anthropic error JSON to the client. Fixed by catching `Anthropic.APIError` specifically, logging the technical detail server-side, and returning a clean message to the client.
- **Native PDF input to Claude instead of `pdf-parse` text extraction for scoring.** `pdf-parse` does raw text extraction and can mangle multi-column resumes or unusual formatting; Claude's document content block reads the PDF's actual layout. `pdf-parse` is kept only as a non-fatal side call to populate the stored `resume_text` field — it no longer gates whether scoring can happen.
- **Evidence-grounded structured output instead of free-text strengths/gaps.** Every `strengths`/`gaps` entry is now `{point, evidence}` — the model has to cite the specific resume/JD language a claim rests on, not just assert it. Paired with per-criterion weighted scoring (`required` vs `preferred`) and a skills matrix, this is the shape recruiter-facing ATS tools actually use, not just a single opaque number.

## Known gotcha: Supabase auto-enables RLS on new tables

`server/supabase/schema.sql` explicitly runs `alter table analyses disable row level security;` — newer Supabase projects auto-enable RLS on every new table by default regardless of what SQL you run, which silently blocks all reads/writes via the anon key with a `42501` error otherwise. This is *still* correct post-auth (see above): RLS being off isn't "no auth," it's "Express enforces the boundary instead of Postgres." If a fresh Supabase project starts throwing RLS errors again, that's why — Supabase's default may have changed again.

## File map

```
server/src/
  lib/          env validation, Supabase client, Anthropic client + model constant
  services/     pdfService (pdf-parse, storage-only text extraction), claudeService (native-PDF scoring), supabaseService (persistence)
  routes/       analyze.ts (POST), analyses.ts (GET list/detail)
  schemas.ts    Zod schema shared between the Claude structured-output call and request validation

client/src/
  lib/          api.ts (useApi() hook — token-attached fetch wrappers), types.ts (shared with server's DB row shape, kept in sync by hand)
  components/   UploadForm, ScoreGauge (SVG ring), RecommendationBadge, CriteriaBreakdown,
                 SkillsMatrixTable, StrengthsGapsList, InterviewQuestions, AnalysisResultView (composes all of the above)
  pages/        Home, History, ResultDetail
  App.tsx       SignedIn/SignedOut gating (Clerk), view-state navigation + nav bar
  main.tsx      wraps the app in <ClerkProvider>
```

## Data model

See `server/supabase/schema.sql` for the authoritative definition. `analyses`: one row per analysis run, scoped by `user_id` (nullable `text`, Clerk ID) — `resume_text`/`jd_text` stored in full so history detail views don't need to re-parse anything. `criteria`, `skills_matrix`, `interview_questions` are jsonb arrays matching the Claude structured-output shape 1:1; `strengths`/`gaps` are jsonb arrays of `{point, evidence}` objects, not plain strings.
