import { Router } from "express";
import { getAnalysisById, listAnalyses, SupabaseServiceError } from "../services/supabaseService.js";

export const analysesRouter = Router();

analysesRouter.get("/analyses", async (_req, res) => {
  try {
    const analyses = await listAnalyses();
    return res.json(analyses);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      return res.status(500).json({ error: "Failed to load analyses" });
    }
    console.error("Unexpected error in GET /api/analyses:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

analysesRouter.get("/analyses/:id", async (req, res) => {
  try {
    const analysis = await getAnalysisById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }
    return res.json(analysis);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      return res.status(500).json({ error: "Failed to load analysis" });
    }
    console.error("Unexpected error in GET /api/analyses/:id:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});
