import { Router } from "express";
import multer from "multer";
import { getAuth } from "@clerk/express";
import { extractResumeText } from "../services/pdfService.js";
import { analyzeResumeAgainstJob, ClaudeAnalysisError } from "../services/claudeService.js";
import { getJobById, SupabaseServiceError } from "../services/jobService.js";
import { createCandidate, deleteCandidate, getCandidateById } from "../services/candidateService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const candidatesRouter = Router();

candidatesRouter.post("/jobs/:jobId/candidates", upload.single("resume"), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to add a candidate" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "A resume PDF file is required" });
  }
  if (file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Resume must be a PDF file" });
  }

  try {
    const job = await getJobById(String(req.params.jobId), userId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Claude reads the PDF natively for scoring (handles layout/columns far
    // better than raw text extraction). pdf-parse only backs the stored
    // resume_text field, so a bad extraction there shouldn't fail the request.
    const [result, extractedText] = await Promise.all([
      analyzeResumeAgainstJob(file.buffer, job.jd_text),
      extractResumeText(file.buffer).catch((err) => {
        console.error("Resume text extraction failed (non-fatal, storage only):", err);
        return "";
      }),
    ]);

    const candidate = await createCandidate({
      jobId: job.id,
      userId,
      resumeText: extractedText,
      resumeFilename: file.originalname,
      result,
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
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to view this candidate" });
  }

  try {
    const candidate = await getCandidateById(req.params.id, userId);
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
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to delete this candidate" });
  }

  try {
    const deleted = await deleteCandidate(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Candidate not found" });
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
