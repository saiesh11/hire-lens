import { supabase } from "../lib/supabase.js";
import { SupabaseServiceError } from "./jobService.js";
import type { AnalysisResult, Recommendation } from "../schemas.js";
import type { GithubEnrichment } from "./githubService.js";

export interface CandidateRow {
  id: string;
  job_id: string;
  user_id: string;
  org_id: string;
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
  github_username: string | null;
  github_enrichment: GithubEnrichment | null;
  github_fetched_at: string | null;
  candidate_name: string | null;
}

export interface CandidateWithJobRow extends CandidateRow {
  job_jd_updated_at: string;
}

export type CandidateListItem = Pick<
  CandidateRow,
  | "id"
  | "created_at"
  | "scored_at"
  | "resume_filename"
  | "match_score"
  | "recommendation"
  | "github_username"
  | "github_enrichment"
  | "summary"
  | "skills_matrix"
>;

export interface DeleteCandidateResult {
  deleted: boolean;
  resumeStoragePath: string | null;
}

export { SupabaseServiceError };

export async function createCandidate(input: {
  jobId: string;
  userId: string;
  orgId: string;
  resumeText: string;
  resumeFilename: string;
  resumeStoragePath: string | null;
  result: AnalysisResult;
  githubUsername: string | null;
  githubEnrichment: GithubEnrichment | null;
}): Promise<CandidateRow> {
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      job_id: input.jobId,
      user_id: input.userId,
      org_id: input.orgId,
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
      candidate_name: input.result.candidateName,
      github_username: input.githubUsername,
      github_enrichment: input.githubEnrichment,
      github_fetched_at: input.githubEnrichment ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new SupabaseServiceError(error?.message ?? "Failed to save candidate");
  }

  return data as CandidateRow;
}

export async function updateCandidateGithub(
  id: string,
  orgId: string,
  input: { username: string; enrichment: GithubEnrichment },
): Promise<CandidateRow | null> {
  const { data, error } = await supabase
    .from("candidates")
    .update({
      github_username: input.username,
      github_enrichment: input.enrichment,
      github_fetched_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as CandidateRow | null;
}

export async function updateCandidateScorecard(
  id: string,
  orgId: string,
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
      candidate_name: result.candidateName,
      scored_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as CandidateRow | null;
}

export async function listCandidatesForJob(
  jobId: string,
  orgId: string,
): Promise<CandidateListItem[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select(
      "id, created_at, scored_at, resume_filename, match_score, recommendation, github_username, github_enrichment, summary, skills_matrix",
    )
    .eq("job_id", jobId)
    .eq("org_id", orgId)
    .order("match_score", { ascending: false });

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data ?? [];
}

export async function listCandidateStoragePathsForJob(
  jobId: string,
  orgId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select("resume_storage_path")
    .eq("job_id", jobId)
    .eq("org_id", orgId);

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return (data ?? [])
    .map((row) => row.resume_storage_path)
    .filter((path): path is string => path !== null);
}

export async function getCandidateById(
  id: string,
  orgId: string,
): Promise<CandidateWithJobRow | null> {
  const { data, error } = await supabase
    .from("candidates")
    .select("*, jobs(jd_updated_at)")
    .eq("id", id)
    .eq("org_id", orgId)
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

export async function deleteCandidate(id: string, orgId: string): Promise<DeleteCandidateResult> {
  const { data, error } = await supabase
    .from("candidates")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, resume_storage_path");

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  const row = data?.[0];
  return { deleted: !!row, resumeStoragePath: row?.resume_storage_path ?? null };
}
