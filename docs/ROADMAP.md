# Roadmap

## v1 (shipped)

Everything in the original brief: upload PDF + JD → Claude score/strengths/gaps/summary → saved to Supabase → history list → detail view. No auth, no multi-resume comparison, no resume builder, no payments. Verified end-to-end with real credentials — see git log for `Add Express + TypeScript API for HireLens v1`.

## v2 direction (stated intent, not yet scoped or started)

The user's stated goal: v1 is the base, not the ceiling. Explicitly called out for future work:

- **UI polish** — "top notch," "well advanced." v1's UI is functional Tailwind (score gauge, strengths/gaps cards, plain nav) but not a designed product surface.
- **Structured, company-standard review output** — "give out reviews in a pattern every company wants." Implies the current shape (`matchScore` + flat `strengths[]`/`gaps[]` + one summary paragraph) may need to become a more formal, structured recruiting-review format — possibly per-criterion breakdown, weighted scoring, or a template matching how real hiring teams structure candidate reviews. Not yet specified which pattern.
- **Best-available AI / accuracy** — "100% reasonable result." Current model is `claude-sonnet-4-6` (matches original brief). Worth revisiting model choice, prompt design, and possibly a verification/self-check pass once the target review format is defined.

None of this is scoped yet — no architecture decisions made, no tickets broken out. When this work starts, this section should be replaced with an actual plan.

## Known v1 limitations (candidates for v2 scoping, not commitments)

- No auth — anyone with the URL can see all history (fine for local/personal use, not fine for a shared deployment)
- No multi-resume / multi-JD batch comparison
- `client/src/lib/types.ts` and the server's DB row shape are kept in sync by hand, not shared — a real monorepo type-sharing setup would remove that drift risk
- Not deployed anywhere — see `DEPLOYMENT.md`
