import { supabase } from "../lib/supabase.js";
import { SupabaseServiceError } from "./jobService.js";
import type { AnalysisResult, Recommendation } from "../schemas.js";

export interface CandidateRow {
  id: string;
  job_id: string;
  user_id: string;
  created_at: string;
  scored_at: string;
  resume_text: string;
  resume_filename: string;
  resume_storage_path: string | null;
  match_score: number;
  recommendation: Recommendation;
  criteria: AnalysisResult["criteria"];
  skills_matrix: AnalysisResult["skillsMatrix"];
  strengths: AnalysisResult["strengths"];
  gaps: AnalysisResult["gaps"];
  interview_questions: string[];
  summary: string;
}

export interface CandidateWithJobRow extends CandidateRow {
  job_jd_updated_at: string;
}

export type CandidateListItem = Pick<
  CandidateRow,
  "id" | "created_at" | "scored_at" | "resume_filename" | "match_score" | "recommendation"
>;

export interface DeleteCandidateResult {
  deleted: boolean;
  resumeStoragePath: string | null;
}

export { SupabaseServiceError };

export async function createCandidate(input: {
  jobId: string;
  userId: string;
  resumeText: string;
  resumeFilename: string;
  resumeStoragePath: string | null;
  result: AnalysisResult;
}): Promise<CandidateRow> {
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      job_id: input.jobId,
      user_id: input.userId,
      resume_text: input.resumeText,
      resume_filename: input.resumeFilename,
      resume_storage_path: input.resumeStoragePath,
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

export async function updateCandidateScorecard(
  id: string,
  userId: string,
  result: AnalysisResult,
): Promise<CandidateRow | null> {
  const { data, error } = await supabase
    .from("candidates")
    .update({
      match_score: result.matchScore,
      recommendation: result.recommendation,
      criteria: result.criteria,
      skills_matrix: result.skillsMatrix,
      strengths: result.strengths,
      gaps: result.gaps,
      interview_questions: result.interviewQuestions,
      summary: result.summary,
      scored_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as CandidateRow | null;
}

export async function listCandidatesForJob(
  jobId: string,
  userId: string,
): Promise<CandidateListItem[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select("id, created_at, scored_at, resume_filename, match_score, recommendation")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("match_score", { ascending: false });

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data ?? [];
}

export async function listCandidateStoragePathsForJob(
  jobId: string,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select("resume_storage_path")
    .eq("job_id", jobId)
    .eq("user_id", userId);

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return (data ?? [])
    .map((row) => row.resume_storage_path)
    .filter((path): path is string => path !== null);
}

export async function getCandidateById(
  id: string,
  userId: string,
): Promise<CandidateWithJobRow | null> {
  const { data, error } = await supabase
    .from("candidates")
    .select("*, jobs(jd_updated_at)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }
  if (!data) {
    return null;
  }

  const { jobs, ...candidate } = data as CandidateRow & {
    jobs: { jd_updated_at: string } | null;
  };
  return { ...candidate, job_jd_updated_at: jobs?.jd_updated_at ?? candidate.created_at };
}

export async function deleteCandidate(id: string, userId: string): Promise<DeleteCandidateResult> {
  const { data, error } = await supabase
    .from("candidates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, resume_storage_path");

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  const row = data?.[0];
  return { deleted: !!row, resumeStoragePath: row?.resume_storage_path ?? null };
}
