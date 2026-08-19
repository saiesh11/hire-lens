import { z } from "zod";

export const criterionSchema = z.object({
  name: z.string(),
  weight: z.enum(["required", "preferred"]),
  score: z.number().int().min(0).max(100),
  notes: z.string(),
});

export const skillMatrixEntrySchema = z.object({
  skill: z.string(),
  status: z.enum(["present", "partial", "missing"]),
  evidence: z.string(),
});

export const evidenceItemSchema = z.object({
  point: z.string(),
  evidence: z.string(),
});

export const recommendationSchema = z.enum(["strong_match", "possible_match", "not_a_match"]);

export const analysisResultSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  recommendation: recommendationSchema,
  criteria: z.array(criterionSchema),
  skillsMatrix: z.array(skillMatrixEntrySchema),
  strengths: z.array(evidenceItemSchema),
  gaps: z.array(evidenceItemSchema),
  interviewQuestions: z.array(z.string()),
  summary: z.string(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;

export const analyzeRequestSchema = z.object({
  jobDescription: z.string().trim().min(1, "Job description is required"),
});
