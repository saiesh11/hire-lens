# Deployment (not done yet — reference for when we do it)

v1 currently runs local-only (`npm run dev` in both `client/` and `server/`). Nothing is deployed. This doc is the plan for when that changes.

## What needs hosting

| Piece | What it is | Status |
|---|---|---|
| Frontend | Static build (`client/dist`) | Not deployed |
| Backend | Long-running Express server | Not deployed |
| Database | Postgres | Already hosted (Supabase) |
| Domain | DNS | Not purchased |

## Recommended path

- **Frontend → Vercel or Netlify.** Free tier. Deploys from GitHub on push.
- **Backend → Render or Railway.** Free tier sleeps after inactivity (slow first request); ~$7/mo hobby tier keeps it always-on.
- **Domain → any registrar** (Namecheap, Cloudflare, Google Domains). ~$10–15/year.
- **Supabase → unchanged**, free tier covers this scale.

## Steps, when we do this

1. Backend deploy: point Render/Railway at `server/`, paste in `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` as dashboard env vars.
2. **Code change required before frontend deploy:** the client currently talks to the backend via the Vite dev-only proxy (`/api` → `localhost:3001` in `vite.config.ts`), which doesn't exist in a static production build. Needs a real API base URL (env var, read at build time) pointing at the deployed backend's URL.
3. Frontend deploy: point Vercel/Netlify at `client/`, set that API base URL env var.
4. Buy the domain, point DNS at Vercel for the frontend; backend usually ends up on a subdomain (`api.yourdomain.com`).
5. Update the backend's CORS (`server/src/index.ts`, currently `cors()` with no origin restriction) to allow only the real production origin.

## Cost, roughly

| Item | Cost |
|---|---|
| Domain | ~$1/mo (paid yearly) |
| Frontend hosting | $0 |
| Backend hosting | $0 (sleeps) or ~$7/mo (always-on) |
| Supabase | $0 at this scale |
| Claude API | usage-based |

**Total: ~$0–8/month** + Claude usage.

## Claude API cost reference

Model: `claude-sonnet-4-6` — $3/1M input tokens, $15/1M output tokens.

As of the v2 scorecard, the resume PDF is sent to Claude natively (a `document` content block) instead of as extracted plain text — Claude reads the actual PDF layout, which costs somewhat more in input tokens than plain text but meaningfully improves accuracy on non-trivial resume formatting. The richer output (per-criterion breakdown, skills matrix, interview questions) also runs larger than the v1 output. Still cents per analysis — $5 of credit comfortably covers ongoing testing and normal use, just don't assume the original ~250–400 analyses/$5 estimate holds exactly; re-check actual usage in the Anthropic console after a batch of real runs if precise budgeting matters.
