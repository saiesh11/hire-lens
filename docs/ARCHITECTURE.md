# Architecture

## Request flow

```
Browser (client, :5173)
  │  POST /api/jobs { title, jdText }  → create a Job once
  │  POST /api/jobs/:id/candidates (multipart, resume PDF) → score a candidate against it
  │  in dev, Vite proxies /api/* → http://localhost:3001
  ▼
Express server (server, :3001)
  │
  ├─ jobService fetches the Job's jd_text (owned, user_id-checked)
  ├─ multer (memory storage) → raw PDF buffer
  ├─ (parallel) claudeService.analyzeResumeAgainstJob(pdfBuffer, job.jd_text)
  │    → Anthropic Messages API, claude-sonnet-4-6, PDF sent as a native
  │      `document` content block — Claude reads the PDF directly, no
  │      text-extraction step in between
  │    → structured JSON via output_config.format (zodOutputFormat)
  │    → { matchScore, recommendation, criteria[], skillsMatrix[],
  │        strengths[], gaps[], interviewQuestions[], summary }
  ├─ (parallel) pdfService.extractResumeText() → plain text, best-effort,
  │    only used for the stored resume_text field — failure here is
  │    logged and falls back to "", it does not fail the request
  ├─ candidateService.createCandidate() → insert into `candidates`, linked via job_id
  ▼
Response: full candidate row → rendered as ScoreGauge, RecommendationBadge,
CriteriaBreakdown, SkillsMatrixTable, StrengthsGapsList, InterviewQuestions
```

`GET /api/jobs`, `GET /api/jobs/:id` (job + its candidates), and `GET /api/candidates/:id` read straight from Supabase, no Claude involved. See "Data model (Phase 2)" below for why a JD is now created once and reused, instead of resubmitted per analysis.

## Auth (Phase 0 of the SaaS rebuild)

Clerk verifies identity; Express stays the sole trust boundary — the client never talks to Supabase directly, it only ever calls this Express API, so there was no reason to stand up Supabase's separate Clerk↔JWT third-party-auth bridge or per-row RLS policies. The pattern:

- `clerkMiddleware()` runs globally in `server/src/index.ts`, attaching the verified session to every request.
- Each protected route reads `getAuth(req).userId` directly (not the deprecated `requireAuth()` — that redirects to a sign-in page, which doesn't make sense for a JSON API; a plain `401` is correct here) and 401s if there's no signed-in user.
- Every `jobService.ts`/`candidateService.ts` function takes a `userId` and adds `.eq('user_id', userId)` — the multi-tenant boundary is enforced in application code, not the database.
- On the client, `lib/api.ts`'s fetch wrappers became a `useApi()` hook (Clerk's `getToken()` is only available inside components under `<ClerkProvider>`) that attaches `Authorization: Bearer <token>` to every request.
- `jobs.user_id` / `candidates.user_id` are `text` columns (Clerk IDs are strings like `user_2abc...`, not `uuid`).

## Why these choices

- **`client.messages.parse()` + `zodOutputFormat()` instead of prompting for JSON and parsing manually.** The brief's original plan was "ask Claude for JSON only, strip markdown fences before `JSON.parse`." The Anthropic SDK has a structured-outputs helper (`output_config.format`) that validates the response against a Zod schema server-side — same schema (`schemas.ts`) is reused for both the Claude call and (implicitly) the DB row shape. Removes an entire class of "Claude wrapped it in a code fence" bugs.
- **No router library on the client.** Three views (Jobs, JobDetail, CandidateDetail) with no deep-linking requirement. Plain `useState` view-switching in `App.tsx` avoids adding `react-router-dom`, which wasn't in the agreed tech stack.
- **Vite dev proxy instead of a client-side API base URL env var.** Keeps local dev to zero client-side config. This does *not* carry over to production — see `DEPLOYMENT.md`, the client needs a real API base URL once it's not being served by the Vite dev server.
- **Anthropic errors are caught and rewritten in `claudeService.ts`**, not left to bubble up raw. Early testing surfaced a real bug: an unhandled `Anthropic.APIError` (e.g. the "credit balance too low" billing error) fell through to a generic 500 and leaked raw Anthropic error JSON to the client. Fixed by catching `Anthropic.APIError` specifically, logging the technical detail server-side, and returning a clean message to the client.
- **Native PDF input to Claude instead of `pdf-parse` text extraction for scoring.** `pdf-parse` does raw text extraction and can mangle multi-column resumes or unusual formatting; Claude's document content block reads the PDF's actual layout. `pdf-parse` is kept only as a non-fatal side call to populate the stored `resume_text` field — it no longer gates whether scoring can happen.
- **Evidence-grounded structured output instead of free-text strengths/gaps.** Every `strengths`/`gaps` entry is now `{point, evidence}` — the model has to cite the specific resume/JD language a claim rests on, not just assert it. Paired with per-criterion weighted scoring (`required` vs `preferred`) and a skills matrix, this is the shape recruiter-facing ATS tools actually use, not just a single opaque number.

## Known gotcha: Supabase auto-enables RLS on new tables

`server/supabase/schema.sql` explicitly runs `alter table ... disable row level security;` on every table it creates — newer Supabase projects auto-enable RLS on every new table by default regardless of what SQL you run, which silently blocks all reads/writes via the anon key with a `42501` error otherwise. This is *still* correct post-auth (see above): RLS being off isn't "no auth," it's "Express enforces the boundary instead of Postgres." If a fresh Supabase project starts throwing RLS errors again, that's why — Supabase's default may have changed again.

## Data model (Phase 2): Jobs + Candidates

The core flow became job-centric in Phase 2: a Job (title + JD text) is created once, then any number of Candidates (one resume upload each) get scored against it — this is what makes sorting and a leaderboard possible (Phase 3), since they need many candidates compared against the *same* JD, which the original one-shot "paste JD, upload one resume" flow couldn't support.

```
jobs                          candidates
├─ id                         ├─ id
├─ user_id                    ├─ job_id  → jobs.id (on delete cascade)
├─ created_at                 ├─ user_id
├─ title                      ├─ created_at
└─ jd_text                    ├─ resume_text, resume_filename
                               └─ match_score, recommendation, criteria,
                                  skills_matrix, strengths, gaps,
                                  interview_questions, summary
```

Deliberately **two tables, not three.** An earlier sketch assumed a candidate might be evaluated against multiple jobs (a many-to-many `evaluations` join table). That's not how this app works — each resume upload is scored against exactly one job, no cross-job candidate reuse — so `candidates` just *is* the evaluation, one row per upload, linked by `job_id`. `on delete cascade` means deleting a Job removes its Candidates automatically.

This superseded the flat `analyses` table from v1/v2 (one row per resume+JD pair, JD text duplicated on every row). A one-time migration (in `schema.sql`, guarded so it only runs once) turned every existing `analyses` row into its own one-off Job with one Candidate, then renamed `analyses` to `analyses_legacy` as an unused backup — the app never reads it. `criteria`, `skills_matrix`, `interview_questions` are jsonb arrays matching the Claude structured-output shape 1:1 on `candidates`; `strengths`/`gaps` are jsonb arrays of `{point, evidence}` objects, not plain strings.

## File map

```
server/src/
  lib/          env validation, Supabase client, Anthropic client + model constant
  services/     pdfService (pdf-parse, storage-only text extraction), claudeService (native-PDF scoring),
                 jobService (Job CRUD), candidateService (Candidate CRUD)
  routes/       jobs.ts (Job CRUD + composed job-with-candidates GET), candidates.ts (create/get/delete a candidate)
  schemas.ts    Zod schemas: analysisResultSchema (shared with the Claude structured-output call),
                 createJobSchema / updateJobSchema (request validation)

client/src/
  lib/          api.ts (useApi() hook — token-attached fetch wrappers), types.ts (shared with server's DB row shape, kept in sync by hand)
  components/   UploadForm (resume-only — the JD field moved to the Job create form), ScoreGauge (SVG ring),
                 RecommendationBadge, CriteriaBreakdown, SkillsMatrixTable, StrengthsGapsList, InterviewQuestions,
                 AnalysisResultView (composes the scorecard components — unchanged since v2, just fed from a Candidate now)
  pages/        Jobs (landing page — create + list), JobDetail (JD, add-candidate form, candidate list),
                 CandidateDetail (the scorecard, via AnalysisResultView)
  App.tsx       SignedIn/SignedOut gating (Clerk), view-state navigation + nav bar
  main.tsx      wraps the app in <ClerkProvider>
```
