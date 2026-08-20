import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getDashboardSummary } from "../services/dashboardService.js";
import { SupabaseServiceError } from "../services/jobService.js";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to view the dashboard" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  try {
    const summary = await getDashboardSummary(orgId);
    return res.json(summary);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to load dashboard summary:", error);
      return res.status(500).json({ error: "Failed to load dashboard" });
    }
    console.error("Unexpected error in GET /api/dashboard:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});
