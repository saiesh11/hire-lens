# Deployment

Hosted entirely on Vercel — the free Hobby tier, no paid plan needed. The client and server live in one Vercel project, deployed from this repo.

## Architecture

The repo is an npm workspace (root `package.json`, `client`/`server` as members) so a single install at the repo root resolves both apps' dependencies. Vercel builds two things from one project:

- **Client** (`client/`) — the existing Vite/React app, built as a static site. `vercel.json`'s `buildCommand`/`outputDirectory` point at it.
- **Server** (`server/`) — the existing Express app, deployed **unchanged as a single Vercel Function**, not rewritten into Next.js API routes or anything framework-specific. Vercel runs Express apps natively.

The only new code is a thin wrapper: `api/[...path].ts` at the repo root imports `server/src/app.ts` (the configured Express app, exported with no `.listen()` call) and re-exports it. Vercel's zero-config convention treats anything under `api/` as a serverless function, and the `[...path]` catch-all filename matches every `/api/*` request to this one function — Express's own internal routing (`app.use("/api", jobsRouter)` etc., unchanged) then dispatches exactly as it does locally. `server/src/index.ts` still exists, trimmed to just `app.listen()` — that's the local-dev entrypoint only (`npm run dev`), never invoked on Vercel.

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
3. Trigger the first deployment. Read the actual build/function logs — confirm the client static build succeeded and the `api/[...path].ts` function built with a reasonable size.
4. Test the deployed URL for real: sign in, view the Dashboard, upload a resume (a real Claude scoring call), confirm it completes well within the 300s limit and the data round-trips against real Supabase/Clerk data — not just that the build succeeded.

## Cost

Free — Hobby tier covers this app's scale (function timeout, function count, bandwidth). Supabase and Clerk stay on their own free tiers, unaffected by this change. The only ongoing cost is Claude API usage, same as before.

## Claude API cost reference

Model: `claude-sonnet-4-6` — $3/1M input tokens, $15/1M output tokens.

The resume PDF is sent to Claude natively (a `document` content block) instead of as extracted plain text — Claude reads the actual PDF layout, which costs somewhat more in input tokens than plain text but meaningfully improves accuracy on non-trivial resume formatting. Still cents per analysis — re-check actual usage in the Anthropic console after a batch of real runs if precise budgeting matters.
