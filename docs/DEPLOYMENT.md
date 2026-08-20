# Deployment

Hosted entirely on Vercel — the free Hobby tier, no paid plan needed. The client and server live in one Vercel project, deployed from this repo.

## Architecture

The repo is an npm workspace (root `package.json`, `client`/`server` as members) so a single install at the repo root resolves both apps' dependencies. Vercel builds two things from one project:

- **Client** (`client/`) — the existing Vite/React app, built as a static site. `vercel.json`'s `buildCommand`/`outputDirectory` point at it.
- **Server** (`server/`) — the existing Express app, deployed **unchanged as a single Vercel Function**, not rewritten into Next.js API routes or anything framework-specific. Vercel runs Express apps natively.

The only new code is a thin wrapper: `api/index.ts` at the repo root imports `server/src/app.ts` (the configured Express app, exported with no `.listen()` call) and re-exports it. A `vercel.json` `rewrites` rule (`/api/:path*` → `/api`) forwards every `/api/*` request to this one function — rewrites preserve the original request path, so Express's own internal routing (`app.use("/api", jobsRouter)` etc., unchanged) dispatches exactly as it does locally. `server/src/index.ts` still exists, trimmed to just `app.listen()` — that's the local-dev entrypoint only (`npm run dev`), never invoked on Vercel.

(Earlier attempt used Vercel's `api/[...path].ts` catch-all filename convention instead of an explicit rewrite — it silently failed to match multi-segment paths like `/api/jobs/:id`, see "Real issues hit" below. The explicit rewrite is the more reliable mechanism.)

Why this instead of a Next.js rewrite: this app is a client-rendered SPA with a thin REST API underneath — nothing about it needs SSR/RSC. A full Next.js migration would mean rewriting every route handler, the client's routing, the Clerk SDK integration, and the file-upload handling, for a benefit this app doesn't use. Deploying the existing Express app as-is achieves the same "hosted on Vercel" outcome for a fraction of the risk and rework.

**Verified before committing to this path**, not assumed: Vercel's Hobby (free) tier gives a 300-second (5-minute) function timeout by default — comfortably more than a Claude resume-scoring call needs. The old "10 seconds on the free tier" limit that would have ruled this out no longer applies.

## What needs hosting vs. what's already hosted

| Piece | What it is | Where |
|---|---|---|
| Client | Vite static build | Vercel (this project) |
| Server | Express API | Vercel (this project, as a Function) |
| Database + file storage | Postgres + the `resumes` bucket | Already hosted (Supabase) — unaffected by this |
| Auth | Clerk | Already hosted (Clerk) — unaffected by this |

Supabase, Clerk, Claude, and GitHub are all external services reached over HTTP with an API key — nothing about them changes when the app moves to Vercel; they just need their keys set as Vercel environment variables (below).

## Environment variables

Set every one of these in the Vercel project's dashboard (Settings → Environment Variables) before the first deploy:

- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `GITHUB_TOKEN` (optional — GitHub enrichment works unauthenticated at a lower rate limit without it)
- `VITE_CLERK_PUBLISHABLE_KEY` — read by the client at **build** time (`client/src/main.tsx`), not runtime. Vercel injects project env vars into the build step, so this resolves correctly as long as it's set before the build runs, same as any other Vite env var.

`PORT` is not needed on Vercel — it only matters for `server/src/index.ts`'s local `app.listen()`, which never runs in the deployed function.

## Steps

1. Connect this GitHub repo to a new Vercel project (Hobby/free tier).
2. Add every environment variable above in the project's dashboard settings.
3. Trigger the first deployment. Read the actual build/function logs — confirm the client static build succeeded and the `api/index.ts` function built with a reasonable size.
4. Test the deployed URL for real: sign in, view the Dashboard, upload a resume (a real Claude scoring call), confirm it completes well within the 300s limit and the data round-trips against real Supabase/Clerk data — not just that the build succeeded.

## Real issues hit on the first deploy (and how they were diagnosed)

Local builds passing is not the same as a working deployment — every one of these passed `npm run build` locally and still broke on Vercel. Kept here since they're the kind of thing that could resurface after unrelated dependency updates.

- **Nothing deployed at all (70ms "build")** — the deployment scaffolding had only ever been built locally, never pushed to GitHub. Vercel deploys the repo, not your filesystem. Obvious in hindsight; easy to miss mid-session.
- **Client build failed: `Cannot find native binding... @rolldown/binding-linux-x64-gnu`** — a lockfile generated on macOS didn't correctly capture the Linux-platform optional dependency for Vite's bundler (npm/cli#4828). Fixed by deleting all `node_modules`/lockfiles and reinstalling clean from the workspace root. If this resurfaces: regenerate the lockfile the same way rather than hand-editing it.
- **Every route 500'd, including ones with nothing to do with PDFs** — `pdf-parse`'s `pdfjs-dist` dependency references `DOMMatrix` at *module load time*, and its optional native canvas polyfill wasn't available on Vercel's Linux runtime (it happened to be present locally, which is why this never surfaced before). Because every route is bundled into one Express app, this crashed the whole function at cold start, not just PDF-related requests — the tell was an unrelated route failing with no application-level error, just a bare 500. Fixed with a small polyfill stub (`server/src/lib/pdfPolyfills.ts`), imported first in `server/src/app.ts`.
- **`/api/jobs` worked, `/api/jobs/:id` silently never reached the function** — confirmed via Vercel's Logs tab showing zero invocations for that request (not an error — nothing at all). The `api/[...path].ts` catch-all filename convention wasn't reliably matching multi-segment paths. Fixed by switching to `api/index.ts` + an explicit `vercel.json` rewrite (current setup, described above) instead of relying on filename-based catch-all detection.

**Diagnostic pattern that worked for all of these**: Vercel's dashboard has two separate log views — **Build Logs** (on the Deployment tab, for build-time failures) and **Logs**/Runtime Logs (its own tab, for what happens when a deployed function actually gets invoked). A 404/500 in the browser with nothing informative usually means checking the wrong one, or means the request never reached the function at all (check whether it shows up in Runtime Logs *at all*, not just whether it shows an error).

## Cost

Free — Hobby tier covers this app's scale (function timeout, function count, bandwidth). Supabase and Clerk stay on their own free tiers, unaffected by this change. The only ongoing cost is Claude API usage, same as before.

## Claude API cost reference

Model: `claude-sonnet-4-6` — $3/1M input tokens, $15/1M output tokens.

The resume PDF is sent to Claude natively (a `document` content block) instead of as extracted plain text — Claude reads the actual PDF layout, which costs somewhat more in input tokens than plain text but meaningfully improves accuracy on non-trivial resume formatting. Still cents per analysis — re-check actual usage in the Anthropic console after a batch of real runs if precise budgeting matters.
