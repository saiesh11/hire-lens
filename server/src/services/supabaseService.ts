import { supabase } from "../lib/supabase.js";
import type { AnalysisResult, Recommendation } from "../schemas.js";

export interface AnalysisRow {
  id: string;
  created_at: string;
  resume_text: string;
  resume_filename: string;
  jd_text: string;
  match_score: number;
  recommendation: Recommendation;
  criteria: AnalysisResult["criteria"];
  skills_matrix: AnalysisResult["skillsMatrix"];
  strengths: AnalysisResult["strengths"];
  gaps: AnalysisResult["gaps"];
  interview_questions: string[];
  summary: string;
  user_id: string;
}

export type AnalysisListItem = Pick<
  AnalysisRow,
  "id" | "created_at" | "resume_filename" | "match_score" | "recommendation"
>;

export class SupabaseServiceError extends Error {}

export async function saveAnalysis(input: {
  userId: string;
  resumeText: string;
  resumeFilename: string;
  jdText: string;
  result: AnalysisResult;
}): Promise<AnalysisRow> {
  const { data, error } = await supabase
    .from("analyses")
    .insert({
      user_id: input.userId,
      resume_text: input.resumeText,
      resume_filename: input.resumeFilename,
      jd_text: input.jdText,
      match_score: input.result.matchScore,
      recommendation: input.result.recommendation,
      criteria: input.result.criteria,
      skills_matrix: input.result.skillsMatrix,
      strengths: input.result.strengths,
      gaps: input.result.gaps,
      interview_questions: input.result.interviewQuestions,
      summary: input.result.summary,
    })
    .select()
    .single();

  if (error || !data) {
    throw new SupabaseServiceError(error?.message ?? "Failed to save analysis");
  }

  return data as AnalysisRow;
}

export async function listAnalyses(userId: string): Promise<AnalysisListItem[]> {
  const { data, error } = await supabase
    .from("analyses")
    .select("id, created_at, resume_filename, match_score, recommendation")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data ?? [];
}

export async function getAnalysisById(id: string, userId: string): Promise<AnalysisRow | null> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as AnalysisRow | null;
}
