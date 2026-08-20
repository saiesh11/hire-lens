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

## Phase 3: bulk upload, sorting, leaderboard — entirely client-side

No backend changes were needed for this phase — `POST /api/jobs/:id/candidates` already scores one resume at a time, and `GET /api/jobs/:id` already returns the full candidate list.

- **Bulk upload** (`components/BulkUploadForm.tsx`) is a queue of independent single-candidate uploads processed **sequentially** (each is a real Claude API call — sequential keeps load predictable and makes per-file progress easy to show), not a new batch endpoint. Each file tracks its own status (queued → scoring → done/failed) and a failed file gets a **Retry** button that just re-calls the same upload function for that one file — the others in the batch are unaffected.
- **Sorting** is a plain client-side `.sort()` over `job.candidates` (small per job — tens of rows, not thousands), not a `?sort=` query param. No extra round-trip.
- **Leaderboard** is presentational only: rank numbers computed from whatever sort is currently active.

**A real bug found via live testing, not just a design nicety:** `JobDetail`'s candidate-list refresh (after each candidate upload) was originally implemented by bumping a `refreshKey` that the data-loading `useEffect` depended on — and that effect sets `isLoading = true` at its start. Since the whole page (including the actively-uploading `BulkUploadForm`) was only rendered when `!isLoading`, every single completed upload in a batch briefly unmounted the entire page, destroying `BulkUploadForm`'s local queue state, then remounted a *fresh, empty* form once the refetch finished — so uploading 5 resumes lost files 2–5 from view after the first one completed. Fixed by splitting the initial (blocking) load from a `refreshJob()` background refresh that only updates `job` state and never touches `isLoading`, so the page — and any component with in-progress local state — never unmounts on a background refresh. General lesson for this codebase: a "loading" flag that hides an entire subtree is only safe for the *initial* load, not for refreshing already-displayed data that some child component might be actively tracking state against.

## JD staleness + manual re-analyze (Phase 4 addendum)

Candidate scorecards are frozen at upload time — editing a job's JD never retroactively re-scores existing candidates. That's correct (re-scoring silently would be surprising), but it used to be invisible: a job's candidate list could mix candidates scored against different JD versions with no indicator. Two additions close that gap:

- **Stale badge.** `jobs.jd_updated_at` bumps only when `jd_text` actually changes — `jobService.updateJob` fetches the current `jd_text` first and compares, because the edit form in `JobDetail.tsx` always submits `title` + `jdText` together, so "the field was present in the request" is not a valid proxy for "the field changed." `candidates.scored_at` (distinct from `created_at`, which still means "when this candidate was added," used for the Newest-First sort) advances on both initial scoring and every re-analyze. A candidate is stale when `scored_at < job.jd_updated_at` (`lib/types.ts`'s `isCandidateStale`), shown as a small amber `StaleBadge` on the `JobDetail` row and the `CandidateDetail` header.
- **Manual re-analyze.** `POST /api/candidates/:id/reanalyze` re-runs the *existing* `claudeService.analyzeResumeAgainstJob` against the job's current `jd_text`, using the **original uploaded PDF** — not the stored `resume_text`, which is the lossier pdf-parse fallback used only for display. This meant the app needed to start persisting uploaded PDFs, which it didn't before (multer previously held the buffer in memory for the request only).

**Storage: a private Supabase Storage bucket (`resumes`), touched only by a service-role client.** This app has no Supabase Auth session — Clerk verifies identity, and Express talks to Supabase with a bare anon key that never signs in as a Supabase user — so `auth.uid()`-scoped storage RLS policies for the anon key aren't just inconsistent with the architecture, they're not functional here at all. `lib/supabaseAdmin.ts` holds a second client built with the service-role key (`SUPABASE_SERVICE_ROLE_KEY`, server-only, never sent to the client) used *exclusively* for Storage operations in `resumeStorageService.ts`; the anon `supabase` client in `lib/supabase.ts` keeps handling every table query, unchanged. **This is a convention, not an enforced boundary** — the service-role client bypasses RLS on everything, so it must never be imported into `jobService.ts`/`candidateService.ts`, whose safety already depends entirely on the app-code `user_id` scoping now that RLS is off.

Resume uploads are stored at `${userId}/${randomUUID()}.pdf`, written alongside scoring as a third, equally non-fatal `Promise.all` branch in `POST /jobs/:jobId/candidates` (same precedent as the existing `extractResumeText` fallback) — a storage failure just leaves `resume_storage_path: null` on that candidate, degrading its re-analyze button to disabled-with-a-tooltip rather than failing candidate creation. The same applies to every candidate that predates this migration. Deleting a candidate or a job best-effort-cleans-up its storage file(s) (`resumeStorageService.deleteResumeFiles`, catches and logs, never throws) — for a job delete, `candidateService.listCandidateStoragePathsForJob` has to run *before* `deleteJob`, since `on delete cascade` removes the candidate rows inside Postgres before a post-delete query could ever see them.

## File map

```
server/src/
  lib/          env validation, Supabase client (anon, table queries), supabaseAdmin (service-role,
                 Storage only), Anthropic client + model constant
  services/     pdfService (pdf-parse, storage-only text extraction), claudeService (native-PDF scoring),
                 jobService (Job CRUD), candidateService (Candidate CRUD), resumeStorageService
                 (original resume PDFs in the private `resumes` bucket)
  routes/       jobs.ts (Job CRUD + composed job-with-candidates GET), candidates.ts (create/get/delete/
                 reanalyze a candidate)
  schemas.ts    Zod schemas: analysisResultSchema (shared with the Claude structured-output call),
                 createJobSchema / updateJobSchema (request validation)

client/src/
  lib/          api.ts (useApi() hook — token-attached fetch wrappers), types.ts (shared with server's DB row shape, kept in sync by hand)
  components/   UploadForm (single-file, unused since Phase 3 but kept — still works), BulkUploadForm (multi-file
                 queue with per-file retry, used by JobDetail), ScoreGauge (SVG ring), RecommendationBadge,
                 StaleBadge (candidate scored before the job's JD was last edited),
                 CriteriaBreakdown, SkillsMatrixTable, StrengthsGapsList, InterviewQuestions,
                 AnalysisResultView (composes the scorecard components — unchanged since v2, just fed from a Candidate now)
  pages/        Jobs (landing page — create + list), JobDetail (JD, bulk-upload form, sortable ranked candidate list),
                 CandidateDetail (the scorecard, via AnalysisResultView)
  App.tsx       SignedIn/SignedOut gating (Clerk), view-state navigation + nav bar
  main.tsx      wraps the app in <ClerkProvider>
```
