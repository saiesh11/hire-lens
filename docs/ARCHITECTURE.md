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
  ├─ jobService fetches the Job's jd_text (org-scoped, org_id-checked)
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

## Organizations + permissions (Phase 5)

Jobs/candidates moved from `user_id`-scoped to `org_id`-scoped, so a team can share the same candidate pool instead of each person having an isolated private account. `user_id` is kept on both tables but its role changed: it's no longer used for query scoping, only written on insert for "who created this" attribution — every `.eq('user_id', userId)` in `jobService.ts`/`candidateService.ts` became `.eq('org_id', orgId)`.

- **Membership is required, not optional** (Clerk Dashboard → Organizations → force every user into an org) — there's no personal/solo data model living alongside orgs, which keeps every route's scoping logic single-model.
- **Role split**: everyone (admin or member) can view, create jobs, edit JDs, upload/re-analyze candidates. Only `org:admin` can delete a job or candidate (`routes/jobs.ts` / `routes/candidates.ts` check `getAuth(req).has({ role: "org:admin" })` before the delete service call runs) and only admins can invite/remove teammates (enforced by Clerk itself via `<OrganizationProfile />`, not app code). These are Clerk's built-in free-tier roles — no custom roles or paid add-on needed.
- **Every route** now checks both `userId` (401 if missing — not signed in) and `orgId` (403 if missing — signed in but no active org) before doing anything else.
- **Client**: org context rides the same session token `useApi()` already attaches via `getToken()` — no changes needed to `lib/api.ts`. `<OrganizationSwitcher />` sits in the nav bar; `App.tsx`'s `RequireOrganization` wrapper is a defensive fallback (renders Clerk's prebuilt `<OrganizationList />` to pick-or-create an org) for the case where a signed-in user has no active org, since "membership required" is a Dashboard-level setting, not something app code can fully guarantee on its own. Delete buttons are also gated client-side on `useAuth().has({ role: "org:admin" })` — a UX nicety so non-admins don't see a button that would 403; the actual enforcement is server-side.
- **Migration**: `scripts/backfillOrganizations.ts` is a one-time, idempotent script (only touches rows where `org_id IS NULL`) that creates one Clerk organization per existing user (`clerkClient.organizations.createOrganization({ name, createdBy: userId })` — passing `createdBy` alone makes that user an `org:admin` member, no separate membership call needed) and backfills `org_id` on their existing jobs/candidates. `org_id` couldn't be `not null` at the same time the column was added, since populating it requires calling the Clerk API, not just SQL — `schema.sql`'s enforcement of `not null` is self-guarding (a no-op until every row has an `org_id`, then automatic on a later re-run), so the file stays safe to run in one shot at any time rather than requiring the user to sequence two manual SQL passes around the script.

## GitHub profile enrichment (Phase 6, pivoted from a planned LinkedIn scraper)

Phase 6 was originally scoped as LinkedIn/profile scraping. That carried real, unavoidable legal exposure (ToS breach, GDPR/CCPA on scraped PII) even scoped as conservatively as possible — no login-wall bypass, no bot-detection evasion, public pages only. Pivoted instead to **GitHub profile enrichment via GitHub's official public REST API** (`api.github.com/users/{username}` + `.../repos`) — not scraping at all, a documented, free, ToS-sanctioned API, and arguably more useful signal for a technical-recruiting tool than a LinkedIn scrape would have been (LinkedIn mostly duplicates the resume; GitHub surfaces real technical activity the resume doesn't).

- `services/githubService.ts`: `extractGithubUsername()` regex-scans the already-extracted `resume_text` for a `github.com/<username>` link (best-effort — a wrong match, e.g. a repo link instead of a profile link, is correctable via the manual entry field, not something the extraction tries to solve perfectly). `fetchGithubProfile()` calls both endpoints, excludes forked repos from language/star aggregation (so forking someone else's project doesn't inflate a candidate's own signal), and returns `{ profile, totalStars, topLanguages, topRepos }`.
- **Auto-detection on upload**: `POST /jobs/:jobId/candidates` runs detection + fetch as a best-effort branch after the existing scoring/text-extraction/storage `Promise.all`, non-fatal exactly like the existing `extractResumeText`/`uploadResumeFile` precedents — most resumes won't match, so this adds no latency for the common case.
- **Manual entry / correction / refresh**, one endpoint: `POST /candidates/:id/github` — same route serves adding a username the auto-detect missed, fixing a wrong one, or refreshing existing data (re-submit the current username). Not admin-gated, since it's data entry, not a destructive action.
- **Deliberately kept separate from the Claude match score** — GitHub enrichment renders as its own labeled section (`GithubProfileCard.tsx`) on `CandidateDetail`, not blended into `match_score` or fed into the Claude prompt. Keeps the transparent, evidence-grounded scoring model unchanged and avoids a prompt-engineering change that belongs to Phase 8 (the AI-provider migration), not here.
- **`GITHUB_TOKEN` is optional**, unlike every other credential in this app. GitHub's API works unauthenticated at 60 requests/hour; a personal access token (sent as `Authorization: Bearer <token>`) raises that to 5,000/hour. Optional so the feature works with zero setup friction, with the token as a pure upgrade if the rate limit becomes a problem.

### Phase 6 addendum: candidate-list badge + name-based search

- **Compact list preview**: `JobDetail`'s candidate rows show a small `GithubSummaryBadge` (`★ <stars> · <top language>`) for any candidate with `github_enrichment` already fetched, so a whole job's candidate list can be scanned for strong GitHub signal without opening each one — `listCandidatesForJob`'s select and `CandidateListItem` were extended with `github_username`/`github_enrichment` to support it. The actual fetch/search UI stays on `CandidateDetail` only; the list row is a single wrapping `<button>` (click-to-navigate), so an interactive form can't be nested there without restructuring it — a non-interactive badge can.
- **Candidate name capture rides the existing Claude call — not a new request.** `analysisResultSchema` gained `candidateName: z.string().nullable()`; the system prompt in `claudeService.ts` asks Claude to report the resume's name (or `null` if it can't confidently tell), same evidence-grounded, don't-guess framing as every other field. `createCandidate` and `updateCandidateScorecard` (the re-analyze path) both persist it — meaning a candidate uploaded before this shipped gets `candidate_name` backfilled for free the next time someone clicks Re-analyze, no separate migration required. This is the *only* place Claude's output feeds into the GitHub feature (a name to search with) — GitHub data still never feeds back into Claude or `match_score`, unchanged from the base Phase 6 design above.
- **Search-and-confirm, deliberately not auto-select.** `githubService.searchGithubUsers()` calls GitHub's `/search/users` (the `in:name` qualifier, confirmed against GitHub's search-syntax docs to match real names, not just usernames) and returns up to 5 candidates. **The app never silently picks the "best" match** — GitHub names aren't unique, so a wrong auto-pick would attribute a stranger's repos/activity to the wrong person, which is worse than showing nothing in a hiring context. Instead `GET /candidates/:id/github/search` returns the short list, and `GithubProfileCard.tsx` renders it as clickable rows (avatar/bio/location) — picking one calls the *same* `POST /candidates/:id/github` save path the manual-entry field already uses, so search is just a faster way to fill in a username, not a second code path.
- **The Search API has its own, much stricter rate limit** than the general REST endpoints used elsewhere in this feature — 10 requests/minute unauthenticated, 30/minute authenticated (vs. 60/hour and 5,000/hour respectively for `/users` and `/users/{username}/repos`). Fine for a one-click-per-candidate, human-triggered search; would not be fine to call automatically or in bulk, which is part of why this stayed a manual action rather than running at upload time alongside the URL-based auto-detection.

## Dashboard (Phase 7)

The Jobs page used to be the landing view — just a bare list with no aggregate sense of "how's hiring going." `Dashboard.tsx` is now the default view, giving an org-wide overview: total jobs/candidates, average score, a recommendation-split pie chart, and a score-distribution bar chart. An earlier version also had a cross-job Top Candidates leaderboard and Recent Activity list — removed after live feedback that it "doesn't help." **Fully removed, not just hidden**: `dashboardService.getDashboardSummary` no longer fetches per-candidate identity fields at all (`job_id`, `candidate_name`, `resume_filename`, `created_at`, the `jobs(title)` embed) — once nothing renders individual candidates, the query needed is just `match_score, recommendation` per row, nothing else. Same standard applied when the "Top Skills" chart was cut, below.

- **Aggregation happens in application code, not a SQL view or RPC.** `dashboardService.getDashboardSummary(orgId)` fetches a `count`-only jobs query plus every org-scoped candidate's `match_score`/`recommendation`, then computes averages/counts/buckets in JS. Matches this app's actual scale (tens of candidates per org) and its existing pattern — `jobService.listJobs`'s candidate count is the only other place doing any DB-side aggregation; everything else is app-code, same here.
- **Score-distribution buckets (`0-49` / `50-74` / `75-100`) reuse the exact thresholds already used everywhere else** — `ScoreGauge.tsx`'s `scoreColor()` and `JobDetail.tsx`'s `scoreClasses()` — so the chart's red/amber/green meaning matches the rest of the app instead of introducing an unrelated new scheme.
- **Recharts is a new dependency** — the first added to the client since Phase 1 (every feature since deliberately avoided new deps, e.g. no router). Confirmed with the user directly rather than added silently, given hand-rolling a histogram/pie chart well (tooltips, legends, responsive sizing) is meaningfully more code than the one existing hand-built visual (`ScoreGauge`'s single animated ring).
- **Chart theming**: Recharts renders literal SVG with JS-supplied color props — it has no idea about Tailwind's `dark:` classes. Structural chart elements (axis text, grid lines, tooltip background) are passed CSS variable references (`var(--muted-foreground)`, `var(--border)`, `var(--card)`) as literal strings, which still resolve correctly through the cascade and flip with the `.dark` class exactly like the rest of the theme (Phase 4). The score/recommendation colors themselves are the same literal hex already used by `ScoreGauge` (`#16a34a`/`#d97706`/`#dc2626`) — those don't need a dark variant, same as today.
- **Polish pass, scoped concretely**: a new shadcn `Skeleton` primitive (`npx shadcn add skeleton`) replaced the plain "Loading..." text on `Jobs`, `JobDetail`, `CandidateDetail`, and `Dashboard` — kept to this one consistent improvement rather than an open-ended redesign.

### Charts upgrade

The recommendation-split and score-distribution charts only re-sliced data already visible elsewhere (score, recommendation) — flagged as visually "boring." First pass added a third chart (an org-wide `skills_matrix` aggregation, "Top Skills Across Your Pool") — genuinely novel data (never surfaced anywhere before), but visually too heavy as a stacked bar next to the other two, and removed after live feedback. **`dashboardService`'s `skills_matrix` select and skill-aggregation logic were fully reverted, not just hidden** — no dead code left behind for a feature that isn't shown.

What stayed, applied to the two original charts instead:
- **Gradient fills within the same established red/amber/green vocabulary** — a shared `<GradientDefs />` component (three `<linearGradient>`s, light-to-dark per color) rendered inside each chart's own `<svg>` (gradient `url()` references only resolve within the same SVG document, so the defs are duplicated per chart, not shared across the two `ResponsiveContainer`s). Still no new hues introduced, consistent with the visual-identity pass above.
- **The recommendation-split donut's center label now counts up on mount** (`useCountUp`, the same cubic-ease pattern as `ScoreGauge`'s animated number, for a consistent feel wherever a number animates in this app) and **dims non-hovered slices** on hover (`activeIndex` state + per-`Cell` opacity transition) — a common, cheap "advanced dashboard" interaction, no extra dependency.
- Both charts got tuned `animationDuration`/`animationEasing` rather than relying on Recharts' bare defaults, and slightly more vertical room (240px, up from 220px) now that they're not sharing the page with a third chart.
- The score-distribution bar chart's average-score `ReferenceLine` is unchanged from the first pass (see git history) — still positioned at whichever bucket contains the average, since the X axis is categorical, not continuous.

## Visual identity pass

Prompted by looking at two AI-recruiting competitors' public marketing pages (Juicebox, Metaview) for inspiration, with an explicit constraint: adopt what's structurally good, not the visual skin — both sites converge on the same dark-hero/glowing-gradient/grain-texture look that's become generic across AI-agent startups broadly, and copying it would make HireLens look like every other one, the opposite of the goal. What got adopted is the underlying information design, executed in HireLens's own visual language:

- **One distinctive display typeface (Fraunces), used only for major headings** — page titles, job titles, candidate names, the `HireLens` wordmark — loaded via a `<link>` in `client/index.html` (Google Fonts, the same reliable mechanism used everywhere else; a broken npm-package font import was already a real mistake once, in Phase 1). Wired through a **new** `--font-display` CSS variable in `index.css`, deliberately *not* the existing `--font-heading` variable — that one already backs every shadcn `CardTitle` app-wide (`components/ui/card.tsx`), so repointing it would have serif-ified every small card section header (Criteria Breakdown, Skills Matrix, GitHub Profile, etc.), which is denser UI text, not a "major heading." `font-display` stays applied to exactly the handful of large headline elements it was meant for.
- **Evidence-first verdict layout** (`AnalysisResultView.tsx`) — the top card used to lead with gauge → badge → one paragraph. It now leads with the score gauge and badge alongside a short bulleted list of the top 2-3 `strengths` (reusing the existing evidence-grounded `EvidenceItem[]` data, no schema change), closer to how a recruiter actually scans a scorecard — verdict first, specifics after. The full breakdown further down the page (`CriteriaBreakdown`, `SkillsMatrixTable`, complete `StrengthsGapsList`) is unchanged.
- **Candidate rows show a highlighted summary snippet**, not just a filename and timestamp. `JobDetail.tsx`'s candidate list rows now render a truncated `summary` (new `lib/highlightTerms.ts` — simple case-insensitive whole-word matching, not NLP) with any `skills_matrix` entries marked `"present"` called out inline via `<mark>`. Needed `listCandidatesForJob`'s select and `CandidateListItem` to gain `summary`/`skills_matrix` (small jsonb, same low-volume reasoning already applied to `github_enrichment` on this same list).
- **Dashboard stat cards get a restrained single-hue tint**, not a gradient — indigo for the general counts, and the Average Score card's tint reuses the same red/amber/green score-meaning colors as everywhere else in the app (`averageScoreCardClasses` in `Dashboard.tsx`, same thresholds as `ScoreGauge`/`scoreClasses`), so the card itself communicates "how's hiring going" at a glance. The chart cards were deliberately left neutral — tinting them too would compete with the charts' own red/amber/green data encoding.
- **Deliberately not done**: no dark hero, no radial glow/spotlight effects, no grain texture, no nav/page-chrome rewrite — those are exactly the borrowed-skin moves that make competitor AI-recruiting sites look like each other.

## Nav bar redesign + Clerk dark-theme fix

Two things bundled together because fixing one properly required the other. The bug: Clerk's rendered components (`OrganizationSwitcher`, `UserButton`, `SignIn`, `OrganizationList`) have their own theming system, entirely separate from the app's Tailwind `.dark` class — toggling `.dark` on `<html>` restyled everything the app built, but Clerk's own components never saw that class, so text was unreadable (black-on-black) in dark mode. Fixed with `@clerk/themes`' `dark` import passed via `appearance={{ theme: theme === "dark" ? dark : undefined }}` — set **once** on `<ClerkProvider>`, cascading to every nested Clerk component with no per-component wiring. This required moving `ClerkProvider` out of `main.tsx` and into `App.tsx`, with `theme` state lifted to the top-level `App` function so the provider can react to it (`main.tsx` still calls `applyStoredTheme()` synchronously before render, to avoid a flash of the wrong theme for the app's own Tailwind styling).

The nav bar itself (`NavBar` in `App.tsx`) got a redesign alongside: an indigo-tinted active-page pill on Dashboard/Jobs, a `Briefcase` icon on the Jobs link, a hover-only lens-scale animation on the logo (deliberately not continuous — an always-animating logo in a persistent bar reads as distracting on a tool used all day), an animated Sun/Moon cross-fade on the theme toggle, a hover-rotate on the settings gear, larger overall sizing, and a slow-drifting indigo/violet/blue "aurora" gradient layer behind the bar (`hl-aurora-drift` keyframe in `index.css`, low opacity, purely decorative — kept inside the existing indigo brand palette rather than introducing new hues, and deliberately restrained per the visual-identity pass's "not the generic AI-startup skin" stance above).

## Client-side routing + page cache

Two related fixes for real reported issues, not planned features. First: the app had no URL-backed navigation — view switching was purely in-memory `useState`, so the browser URL never left `/` and two-finger trackpad swipe-back (a shortcut for `history.back()`) had no history entries to act on. Fixed with a small hand-rolled History API layer rather than a router dependency — `client/src/lib/router.ts`'s `View` type plus `pathForView`/`viewFromPath` map the app's 5 flat view states to real routes (`/`, `/jobs`, `/jobs/:id`, `/jobs/:id/candidates/:id`, `/settings`); `App.tsx`'s `navigate()` pushes a history entry per view change, a `popstate` listener syncs state back on browser back/forward/swipe. In-app "Back" buttons call a `goBack()` helper that prefers real `history.back()` (so the stack shrinks instead of growing on every click) over pushing a new entry, falling back to a push only when the current entry has no local history behind it (a direct/deep link with nothing to pop). `vercel.json` gained a catch-all rewrite (`/(.*) → /index.html`) so refreshing on a deep route doesn't 404 against Vercel's static hosting — Vite's dev server already does this by default.

One real bug surfaced while building this: the org-switch effect (resets the view to Dashboard when the active org changes) originally used a "skip the first run" boolean guard, which React's StrictMode defeats in development — StrictMode double-invokes every effect on mount, so the guard disarmed itself on the same tick it was meant to protect, wiping a URL-derived deep link back to `/` on every dev-mode page load. Fixed by comparing actual org identities (`previous && orgId && previous !== orgId`) instead of counting renders — immune to how many times Clerk emits an `orgId` change while resolving a session.

Second: once back/forward navigation was actually usable, revisiting a page re-fetched from scratch every time (Dashboard/Jobs/JobDetail/CandidateDetail all fetch on mount, no caching). `client/src/lib/pageCache.ts` (a module-level `Map`) plus `client/src/lib/useCachedResource.ts` (the hook all four pages now use) add stale-while-revalidate: a cached value renders instantly with no loading skeleton while a fresh fetch always happens silently in the background, updating the cache and the UI once it resolves. A background revalidation failure never clobbers already-shown good data — `error` only surfaces when there's nothing cached to fall back on. The cache is cleared entirely (`clearCache()`) on a real org switch, since every cached key belongs to whichever org was active when it was fetched — briefly showing another org's cached data would be a real cross-tenant leak, not just a staleness nit. Deliberately *not* doing fine-grained cross-page invalidation (e.g. clearing the Jobs list's cache the instant a candidate is added elsewhere) — the stale-while-revalidate pattern already self-corrects within one round-trip the next time each page is actually visited, matching standard SWR/React Query default behavior, and this app's mutation frequency doesn't justify hand-chasing every cross-key dependency.

## Bulk upload: fixed a double-submission race

Reported live: uploading 2 resumes created 3 candidates, with one filename duplicated. Root cause in `BulkUploadForm.tsx`: `isProcessing` (React state) gates the Add/Retry buttons' `disabled` attribute, but state updates aren't synchronous — two clicks close enough together (a fast double-click, or a slow first click registering twice) could both invoke `handleStart`/`handleRetry` before the first call's disabled state actually committed to the DOM, each independently reading the same "queued" entries and submitting them. Fixed with a `useRef` re-entrancy guard (`isBusyRef`) checked synchronously at the top of both handlers — refs update immediately, unlike state, so a second near-simultaneous call sees the flag already set and bails out before doing anything, closing the race that `disabled={isProcessing}` alone couldn't.

## File map

```
server/src/
  lib/          env validation, Supabase client (anon, table queries), supabaseAdmin (service-role,
                 Storage only), Anthropic client + model constant
  services/     pdfService (pdf-parse, storage-only text extraction), claudeService (native-PDF scoring,
                 also captures candidateName), jobService (Job CRUD), candidateService (Candidate CRUD),
                 resumeStorageService (original resume PDFs in the private `resumes` bucket),
                 githubService (GitHub API profile enrichment + name-based search), dashboardService
                 (org-wide stats/charts, aggregated in application code)
  routes/       jobs.ts (Job CRUD + composed job-with-candidates GET), candidates.ts (create/get/delete/
                 reanalyze/github-enrich/github-search a candidate), dashboard.ts (org summary)
  scripts/      backfillOrganizations.ts (one-time Phase 5 migration, run manually via tsx)
  schemas.ts    Zod schemas: analysisResultSchema (shared with the Claude structured-output call,
                 includes candidateName), createJobSchema / updateJobSchema / setCandidateGithubSchema

client/src/
  lib/          api.ts (useApi() hook — token-attached fetch wrappers), types.ts (shared with server's DB row shape, kept in sync by hand), highlightTerms.ts (candidate-row summary term highlighting), router.ts (View type + URL <-> view mapping), pageCache.ts (module-level cache Map), useCachedResource.ts (stale-while-revalidate fetch hook), preferences.ts (theme/sort, localStorage-backed)
  components/   UploadForm (single-file, unused since Phase 3 but kept — still works), BulkUploadForm (multi-file
                 queue with per-file retry, used by JobDetail), ScoreGauge (SVG ring), RecommendationBadge,
                 StaleBadge (candidate scored before the job's JD was last edited),
                 GithubProfileCard (fetch/search/display GitHub enrichment, own local form state),
                 GithubSummaryBadge (compact list-row preview of already-fetched enrichment),
                 HighlightedSummary (candidate-row summary snippet with matched skills marked),
                 CriteriaBreakdown, SkillsMatrixTable, StrengthsGapsList, InterviewQuestions,
                 AnalysisResultView (composes the scorecard components, evidence-first verdict layout)
  pages/        Dashboard (landing page — org-wide stats + animated charts), Jobs (create + list),
                 JobDetail (JD, bulk-upload form, sortable ranked candidate list),
                 CandidateDetail (the scorecard, via AnalysisResultView)
  App.tsx       ClerkProvider (with theme-aware appearance) + SignedIn/SignedOut gating, URL-backed
                 navigation (navigate()/goBack(), popstate sync), the redesigned nav bar
  main.tsx      applies the stored theme before first render, renders <App />
```
