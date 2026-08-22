# Roadmap

## v1 (shipped)

Everything in the original brief: upload PDF + JD → Claude score/strengths/gaps/summary → saved to Supabase → history list → detail view. No auth, no multi-resume comparison, no resume builder, no payments. Verified end-to-end with real credentials — see git log for `Add Express + TypeScript API for HireLens v1`.

## v2: structured scorecard + evidence grounding + native PDF reading + UI polish (shipped)

- **Structured, company-standard review output.** Weighted per-criterion breakdown (`required` vs `preferred`, 0-100 each with notes), categorical `recommendation` (strong_match / possible_match / not_a_match), a skills matrix (present/partial/missing per named skill), suggested interview questions. Every strength/gap carries `{point, evidence}` grounding the claim in the actual resume/JD text.
- **Accuracy: native PDF input.** Claude reads the resume PDF directly via a `document` content block instead of `pdf-parse` text extraction for scoring.
- **Bias-safety instruction** in the system prompt: score only on job-relevant qualifications.
- **UI redesign:** cohesive card system, fixed a real overlap bug in `ScoreGauge` (was a negative-margin hack), a search-themed loading animation that overlays in place on the upload card (no scroll needed while waiting), auto-scroll to results on completion, drag-and-drop upload.

See `ARCHITECTURE.md` for implementation detail.

## v3: SaaS rebuild (shipped, live in production)

The user's friends reviewed v2 and pushed for a full pivot: auth, multi-tenancy, bulk processing, sorting/leaderboards, a shadcn/ui rebuild, richer candidate signal beyond the resume, and — last — a switch from Claude to Google Gemini. This was a re-architecture; full context and the phase sequencing rationale are in git history around the "Phase 0" commits.

Phases, in build order:

| # | Phase | Status |
|---|---|---|
| 0 | Auth + multi-tenant foundation (Clerk) | ✅ Done, verified live |
| 1 | shadcn/ui migration | ✅ Done, verified live |
| 2 | Core data model + CRUD (jobs, candidates) | ✅ Done, verified live — see "Data model (Phase 2)" in `ARCHITECTURE.md` |
| 3 | Bulk profile upload, candidate sorting, leaderboard | ✅ Done, verified live — entirely client-side, see `ARCHITECTURE.md` |
| 4 | Account preferences / settings (dark mode, default sort) | ✅ Done, verified live |
| 4a | JD staleness detection + manual re-analyze | ✅ Done, verified live |
| 5 | Organization settings + permissions (Clerk Organizations, admin/member roles) | ✅ Done, verified live |
| 6 | GitHub profile enrichment *(pivoted from an originally-planned LinkedIn scraper — see `ARCHITECTURE.md` for why)*, plus name-based search-and-confirm | ✅ Done, verified live |
| 7 | Dashboard: org-wide stats, animated charts | ✅ Done, verified live |
| — | Hosting on Vercel (client static build + Express server as a single Function) | ✅ Done, live in production |
| — | Distinctive visual identity pass, nav bar redesign, URL-backed client-side routing, a stale-while-revalidate page cache | ✅ Done, verified live |
| 8 | AI provider: Claude → Google Gemini *(user said: after everything else)* | Not started — only thing left |
| ~~9~~ | ~~MCP integration~~ | Descoped — decided not to build it |

## Known limitations (candidates for future scoping, not commitments)

- `client/src/lib/types.ts` and the server's DB row shape are kept in sync by hand, not shared — a real monorepo type-sharing setup would remove that drift risk
- The deployed app currently runs on a Clerk **development** instance (visible as a "Development mode" badge on the sign-in screen) — fine for demoing, but should move to a Clerk production instance before real usage at scale
- Pre-auth rows (`user_id = null`) never made it into `jobs`/`candidates` — they're preserved untouched in `analyses_legacy`, which the app no longer reads (see "Data model (Phase 2)" in `ARCHITECTURE.md`)
