import { Router } from "express";
import multer from "multer";
import { getAuth } from "@clerk/express";
import { analyzeRequestSchema } from "../schemas.js";
import { extractResumeText } from "../services/pdfService.js";
import { analyzeResumeAgainstJob, ClaudeAnalysisError } from "../services/claudeService.js";
import { saveAnalysis, SupabaseServiceError } from "../services/supabaseService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const analyzeRouter = Router();

analyzeRouter.post("/analyze", upload.single("resume"), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to analyze a resume" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "A resume PDF file is required" });
  }
  if (file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Resume must be a PDF file" });
  }

  const parsedBody = analyzeRequestSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.issues[0]?.message ?? "Invalid request" });
  }
  const { jobDescription } = parsedBody.data;

  try {
    // Claude reads the PDF natively for scoring (handles layout/columns far
    // better than raw text extraction). pdf-parse only backs the stored
    // resume_text field, so a bad extraction there shouldn't fail the request.
    const [result, extractedText] = await Promise.all([
      analyzeResumeAgainstJob(file.buffer, jobDescription),
      extractResumeText(file.buffer).catch((err) => {
        console.error("Resume text extraction failed (non-fatal, storage only):", err);
        return "";
      }),
    ]);

    const saved = await saveAnalysis({
      userId,
      resumeText: extractedText,
      resumeFilename: file.originalname,
      jdText: jobDescription,
      result,
    });
    return res.status(201).json(saved);
  } catch (error) {
    if (error instanceof ClaudeAnalysisError) {
      return res.status(502).json({ error: error.message });
    }
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to save analysis:", error);
      return res.status(500).json({ error: "Failed to save analysis" });
    }
    console.error("Unexpected error in /api/analyze:", error);
    return res.status(500).json({ error: "Something went wrong analyzing the resume" });
  }
});
