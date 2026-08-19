import { z } from "zod";

export const analysisResultSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  summary: z.string(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const analyzeRequestSchema = z.object({
  jobDescription: z.string().trim().min(1, "Job description is required"),
});
