# Roadmap

## v1 (shipped)

Everything in the original brief: upload PDF + JD → Claude score/strengths/gaps/summary → saved to Supabase → history list → detail view. No auth, no multi-resume comparison, no resume builder, no payments. Verified end-to-end with real credentials — see git log for `Add Express + TypeScript API for HireLens v1`.

## v2 step 1: structured scorecard + evidence grounding + native PDF reading (shipped)

Delivered two of the three stated v2 pillars — see `ARCHITECTURE.md` for the shape and prompt details:

- **Structured, company-standard review output.** Replaced flat `strengths[]`/`gaps[]` + one score with: weighted per-criterion breakdown (`required` vs `preferred`, each scored 0-100 with notes), a categorical `recommendation` (strong_match / possible_match / not_a_match), a skills matrix (present/partial/missing per named skill), and suggested interview questions targeting the identified gaps. Every strength/gap now carries a `point` + `evidence` pair grounding the claim in the actual resume/JD text.
- **Accuracy: native PDF input.** Claude now reads the resume PDF directly via a `document` content block instead of going through `pdf-parse` text extraction for scoring. `pdf-parse` is still used, but only as a best-effort, non-fatal side extraction for the stored `resume_text` field — a bad extraction there no longer fails the request.
- **Bias-safety instruction** added to the system prompt: score only on job-relevant qualifications, never infer protected characteristics.

Not yet done from the original three pillars: **UI redesign** ("top notch, well advanced"). The UI was extended with new components (criteria breakdown bars, skills matrix table, recommendation badges, interview question list) to surface the new data, but this was functional wiring, not a visual design pass.

## v2 step 2: UI redesign (not yet started)

The richer data shape from step 1 is now stable, which was the blocker called out in the original recommendation ("redesigning UI before the output shape changes risks throwing it away"). Candidate ideas parked from the original brainstorm: animated score reveal, staged loading states, richer History (sort/filter/search + stats strip), side-by-side JD-vs-resume comparison view, drag-and-drop upload, dark mode, inline resume preview.

## Beyond the three original pillars (not scoped)

- **Multi-resume ranking against one JD** — score N resumes, get a ranked shortlist. Explicitly out of v1 scope but likely the highest-value recruiter-facing feature for a v3.
- **JD structuring as its own step** — parse the JD into structured requirements before scoring, for more consistency across differently-phrased JDs.

## Known limitations (candidates for future scoping, not commitments)

- No auth — anyone with the URL can see all history (fine for local/personal use, not fine for a shared deployment)
- No multi-resume / multi-JD batch comparison
- `client/src/lib/types.ts` and the server's DB row shape are kept in sync by hand, not shared — a real monorepo type-sharing setup would remove that drift risk
- Not deployed anywhere — see `DEPLOYMENT.md`
