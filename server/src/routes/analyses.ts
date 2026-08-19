import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getAnalysisById, listAnalyses, SupabaseServiceError } from "../services/supabaseService.js";

export const analysesRouter = Router();

analysesRouter.get("/analyses", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to view your analyses" });
  }

  try {
    const analyses = await listAnalyses(userId);
    return res.json(analyses);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to load analyses:", error);
      return res.status(500).json({ error: "Failed to load analyses" });
    }
    console.error("Unexpected error in GET /api/analyses:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

analysesRouter.get("/analyses/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to view this analysis" });
  }

  try {
    const analysis = await getAnalysisById(req.params.id, userId);
    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }
    return res.json(analysis);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to load analysis:", error);
      return res.status(500).json({ error: "Failed to load analysis" });
    }
    console.error("Unexpected error in GET /api/analyses/:id:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});
