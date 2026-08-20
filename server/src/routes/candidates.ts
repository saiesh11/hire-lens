import { Router } from "express";
import multer from "multer";
import { getAuth } from "@clerk/express";
import { extractResumeText } from "../services/pdfService.js";
import { analyzeResumeAgainstJob, ClaudeAnalysisError } from "../services/claudeService.js";
import { getJobById, SupabaseServiceError } from "../services/jobService.js";
import {
  createCandidate,
  deleteCandidate,
  getCandidateById,
  updateCandidateScorecard,
  updateCandidateGithub,
} from "../services/candidateService.js";
import {
  uploadResumeFile,
  downloadResumeFile,
  deleteResumeFiles,
  ResumeStorageError,
} from "../services/resumeStorageService.js";
import { extractGithubUsername, fetchGithubProfile, searchGithubUsers, GithubApiError } from "../services/githubService.js";
import { setCandidateGithubSchema } from "../schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const candidatesRouter = Router();

candidatesRouter.post("/jobs/:jobId/candidates", upload.single("resume"), async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to add a candidate" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "A resume PDF file is required" });
  }
  if (file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Resume must be a PDF file" });
  }

  try {
    const job = await getJobById(String(req.params.jobId), orgId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Claude reads the PDF natively for scoring (handles layout/columns far
    // better than raw text extraction). pdf-parse only backs the stored
    // resume_text field, so a bad extraction there shouldn't fail the request.
    // Uploading the original PDF to storage is likewise non-fatal — it only
    // gates whether manual re-analysis is available later, not scoring now.
    const [result, extractedText, resumeStoragePath] = await Promise.all([
      analyzeResumeAgainstJob(file.buffer, job.jd_text),
      extractResumeText(file.buffer).catch((err) => {
        console.error("Resume text extraction failed (non-fatal, storage only):", err);
        return "";
      }),
      uploadResumeFile(userId, file.buffer).catch((err) => {
        console.error("Resume file upload failed (non-fatal — re-analyze won't be available for this candidate):", err);
        return null;
      }),
    ]);

    // Best-effort auto-detect: most resumes won't have a GitHub link, so this
    // adds no latency for the common case; when one is found, it's one extra
    // sequential call after the batch above, not blocking scoring.
    const githubUsername = extractGithubUsername(extractedText);
    const githubEnrichment = githubUsername
      ? await fetchGithubProfile(githubUsername).catch((err) => {
          console.error("GitHub enrichment fetch failed (non-fatal):", err);
          return null;
        })
      : null;

    const candidate = await createCandidate({
      jobId: job.id,
      userId,
      orgId,
      resumeText: extractedText,
      resumeFilename: file.originalname,
      resumeStoragePath,
      result,
      githubUsername,
      githubEnrichment,
    });
    return res.status(201).json(candidate);
  } catch (error) {
    if (error instanceof ClaudeAnalysisError) {
      return res.status(502).json({ error: error.message });
    }
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to save candidate:", error);
      return res.status(500).json({ error: "Failed to save candidate" });
    }
    console.error("Unexpected error in POST /api/jobs/:jobId/candidates:", error);
    return res.status(500).json({ error: "Something went wrong analyzing the resume" });
  }
});

candidatesRouter.get("/candidates/:id", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to view this candidate" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  try {
    const candidate = await getCandidateById(req.params.id, orgId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    return res.json(candidate);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to load candidate:", error);
      return res.status(500).json({ error: "Failed to load candidate" });
    }
    console.error("Unexpected error in GET /api/candidates/:id:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

candidatesRouter.delete("/candidates/:id", async (req, res) => {
  const auth = getAuth(req);
  const { userId, orgId } = auth;
  if (!userId) {
    return res.status(401).json({ error: "Sign in to delete this candidate" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }
  if (!auth.has({ role: "org:admin" })) {
    return res.status(403).json({ error: "Only organization admins can delete this" });
  }

  try {
    const { deleted, resumeStoragePath } = await deleteCandidate(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    if (resumeStoragePath) {
      await deleteResumeFiles([resumeStoragePath]);
    }
    return res.status(204).send();
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to delete candidate:", error);
      return res.status(500).json({ error: "Failed to delete candidate" });
    }
    console.error("Unexpected error in DELETE /api/candidates/:id:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

candidatesRouter.post("/candidates/:id/reanalyze", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to re-analyze this candidate" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  try {
    const candidate = await getCandidateById(req.params.id, orgId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    if (!candidate.resume_storage_path) {
      return res.status(400).json({
        error: "The original resume file isn't available for this candidate — remove and re-upload it to enable re-analysis.",
      });
    }

    const job = await getJobById(candidate.job_id, orgId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const pdfBuffer = await downloadResumeFile(candidate.resume_storage_path);
    const result = await analyzeResumeAgainstJob(pdfBuffer, job.jd_text);
    const updated = await updateCandidateScorecard(candidate.id, orgId, result);
    if (!updated) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    return res.json(updated);
  } catch (error) {
    if (error instanceof ClaudeAnalysisError) {
      return res.status(502).json({ error: error.message });
    }
    if (error instanceof ResumeStorageError) {
      console.error("Failed to retrieve resume file for re-analysis:", error);
      return res.status(502).json({ error: "Couldn't retrieve the original resume file for re-analysis" });
    }
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to re-analyze candidate:", error);
      return res.status(500).json({ error: "Failed to re-analyze candidate" });
    }
    console.error("Unexpected error in POST /api/candidates/:id/reanalyze:", error);
    return res.status(500).json({ error: "Something went wrong re-analyzing this candidate" });
  }
});

// Serves three cases with one endpoint: adding a username the auto-detect
// missed, correcting a wrong auto-detected one, and refreshing existing
// enrichment (re-submit the currently-stored username). Any org member can
// call this — it's data entry, not a destructive action, so no admin gate.
candidatesRouter.post("/candidates/:id/github", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to update this candidate" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  const parsed = setCandidateGithubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const candidate = await getCandidateById(req.params.id, orgId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    const enrichment = await fetchGithubProfile(parsed.data.username);
    const updated = await updateCandidateGithub(candidate.id, orgId, {
      username: enrichment.profile.login,
      enrichment,
    });
    if (!updated) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    return res.json(updated);
  } catch (error) {
    if (error instanceof GithubApiError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to save GitHub enrichment:", error);
      return res.status(500).json({ error: "Failed to save GitHub enrichment" });
    }
    console.error("Unexpected error in POST /api/candidates/:id/github:", error);
    return res.status(500).json({ error: "Something went wrong fetching GitHub data" });
  }
});

// Read-only — searches GitHub by the candidate's own captured name (no query
// param needed) and returns a short list for a human to pick from. Never
// auto-selects a result: names aren't unique, so silently attributing a
// stranger's GitHub activity to the wrong candidate would be worse than
// showing nothing. Not admin-gated, no mutation happens here.
candidatesRouter.get("/candidates/:id/github/search", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to search for this candidate" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  try {
    const candidate = await getCandidateById(req.params.id, orgId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    if (!candidate.candidate_name) {
      return res.status(400).json({
        error: "This candidate's name hasn't been captured yet — re-analyze them to capture it.",
      });
    }

    const results = await searchGithubUsers(candidate.candidate_name);
    return res.json(results);
  } catch (error) {
    if (error instanceof GithubApiError) {
      return res.status(502).json({ error: error.message });
    }
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to load candidate for GitHub search:", error);
      return res.status(500).json({ error: "Failed to search GitHub" });
    }
    console.error("Unexpected error in GET /api/candidates/:id/github/search:", error);
    return res.status(500).json({ error: "Something went wrong searching GitHub" });
  }
});
