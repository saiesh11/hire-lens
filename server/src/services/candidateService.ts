import { supabase } from "../lib/supabase.js";
import { SupabaseServiceError } from "./jobService.js";
import type { AnalysisResult, Recommendation } from "../schemas.js";

export interface CandidateRow {
  id: string;
  job_id: string;
  user_id: string;
  created_at: string;
  resume_text: string;
  resume_filename: string;
  match_score: number;
  recommendation: Recommendation;
  criteria: AnalysisResult["criteria"];
  skills_matrix: AnalysisResult["skillsMatrix"];
  strengths: AnalysisResult["strengths"];
  gaps: AnalysisResult["gaps"];
  interview_questions: string[];
  summary: string;
}

export type CandidateListItem = Pick<
  CandidateRow,
  "id" | "created_at" | "resume_filename" | "match_score" | "recommendation"
>;

export { SupabaseServiceError };

export async function createCandidate(input: {
  jobId: string;
  userId: string;
  resumeText: string;
  resumeFilename: string;
  result: AnalysisResult;
}): Promise<CandidateRow> {
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      job_id: input.jobId,
      user_id: input.userId,
      resume_text: input.resumeText,
      resume_filename: input.resumeFilename,
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
    throw new SupabaseServiceError(error?.message ?? "Failed to save candidate");
  }

  return data as CandidateRow;
}

export async function listCandidatesForJob(
  jobId: string,
  userId: string,
): Promise<CandidateListItem[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select("id, created_at, resume_filename, match_score, recommendation")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("match_score", { ascending: false });

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data ?? [];
}

export async function getCandidateById(id: string, userId: string): Promise<CandidateRow | null> {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as CandidateRow | null;
}

export async function deleteCandidate(id: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("candidates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return (data?.length ?? 0) > 0;
}
