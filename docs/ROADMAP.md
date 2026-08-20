# Roadmap

## v1 (shipped)

Everything in the original brief: upload PDF + JD → Claude score/strengths/gaps/summary → saved to Supabase → history list → detail view. No auth, no multi-resume comparison, no resume builder, no payments. Verified end-to-end with real credentials — see git log for `Add Express + TypeScript API for HireLens v1`.

## v2: structured scorecard + evidence grounding + native PDF reading + UI polish (shipped)

- **Structured, company-standard review output.** Weighted per-criterion breakdown (`required` vs `preferred`, 0-100 each with notes), categorical `recommendation` (strong_match / possible_match / not_a_match), a skills matrix (present/partial/missing per named skill), suggested interview questions. Every strength/gap carries `{point, evidence}` grounding the claim in the actual resume/JD text.
- **Accuracy: native PDF input.** Claude reads the resume PDF directly via a `document` content block instead of `pdf-parse` text extraction for scoring.
- **Bias-safety instruction** in the system prompt: score only on job-relevant qualifications.
- **UI redesign:** cohesive card system, fixed a real overlap bug in `ScoreGauge` (was a negative-margin hack), a search-themed loading animation that overlays in place on the upload card (no scroll needed while waiting), auto-scroll to results on completion, drag-and-drop upload.

See `ARCHITECTURE.md` for implementation detail.

## v3: SaaS rebuild (in progress)

The user's friends reviewed v2 and pushed for a full pivot: auth, multi-tenancy, bulk processing, sorting/leaderboards, a shadcn/ui rebuild, LinkedIn scraping, and — last — a switch from Claude to Google Gemini. This is a re-architecture; full context, the phase sequencing rationale, and the legal flag on LinkedIn scraping are in the approved plan at the time: see git history around "Phase 0" commits, or ask to see the original plan if it's needed again.

Phases, in build order:

| # | Phase | Status |
|---|---|---|
| 0 | Auth + multi-tenant foundation (Clerk) | ✅ Done, verified live |
| 1 | shadcn/ui migration | ✅ Done, verified live |
| 2 | Core data model + CRUD (jobs, candidates) | ✅ Done, verified live — see "Data model (Phase 2)" in `ARCHITECTURE.md` |
| 3 | Bulk profile upload, candidate sorting, leaderboard | ✅ Done, verified live — entirely client-side, see `ARCHITECTURE.md` |
| 4 | Account preferences / settings | Not started |
| 5 | Organization settings + permissions *(optional)* | Not started |
| 6 | LinkedIn/profile scraping pipeline *(legal risk flagged — public pages only, no login-bypass or anti-detection tooling; user should get legal review before production)* | Not started |
| 7 | Dashboard optimization | Not started |
| 8 | AI provider: Claude → Google Gemini *(user said: after everything else)* | Not started |
| 9 | MCP integration *(optional, last)* | Not started |

Each phase gets its own detailed plan when we reach it — planning phases 1–9 in file-level detail now would be stale by the time we get there, since early decisions (like phase 0's exact auth pattern) shape what later phases even look like.

## Known limitations (candidates for future scoping, not commitments)

- `client/src/lib/types.ts` and the server's DB row shape are kept in sync by hand, not shared — a real monorepo type-sharing setup would remove that drift risk
- Not deployed anywhere — see `DEPLOYMENT.md`
- Pre-auth rows (`user_id = null`) never made it into `jobs`/`candidates` — they're preserved untouched in `analyses_legacy`, which the app no longer reads (see "Data model (Phase 2)" in `ARCHITECTURE.md`)
