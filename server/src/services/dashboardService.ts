import { supabase } from "../lib/supabase.js";
import { SupabaseServiceError } from "./jobService.js";
import type { Recommendation } from "../schemas.js";

export interface DashboardCandidate {
  id: string;
  job_id: string;
  job_title: string;
  candidate_name: string | null;
  resume_filename: string;
  match_score: number;
  recommendation: Recommendation;
  created_at: string;
}

export interface DashboardSummary {
  totalJobs: number;
  totalCandidates: number;
  averageScore: number | null;
  recommendationCounts: Record<Recommendation, number>;
  scoreDistribution: { bucket: string; count: number }[];
  topCandidates: DashboardCandidate[];
  recentCandidates: DashboardCandidate[];
}

interface CandidateAggregateRow {
  id: string;
  job_id: string;
  candidate_name: string | null;
  resume_filename: string;
  match_score: number;
  recommendation: Recommendation;
  created_at: string;
  jobs: { title: string } | null;
}

export async function getDashboardSummary(orgId: string): Promise<DashboardSummary> {
  const [jobsResult, candidatesResult] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase
      .from("candidates")
      .select("id, job_id, candidate_name, resume_filename, match_score, recommendation, created_at, jobs(title)")
      .eq("org_id", orgId),
  ]);

  if (jobsResult.error) {
    throw new SupabaseServiceError(jobsResult.error.message);
  }
  if (candidatesResult.error) {
    throw new SupabaseServiceError(candidatesResult.error.message);
  }

  const rows = (candidatesResult.data ?? []) as unknown as CandidateAggregateRow[];
  const candidates: DashboardCandidate[] = rows.map((row) => ({
    id: row.id,
    job_id: row.job_id,
    job_title: row.jobs?.title ?? "Untitled job",
    candidate_name: row.candidate_name,
    resume_filename: row.resume_filename,
    match_score: row.match_score,
    recommendation: row.recommendation,
    created_at: row.created_at,
  }));

  const recommendationCounts: Record<Recommendation, number> = {
    strong_match: 0,
    possible_match: 0,
    not_a_match: 0,
  };
  // Same thresholds as ScoreGauge.tsx's scoreColor() and JobDetail.tsx's
  // scoreClasses() — ties this chart to the red/amber/green vocabulary
  // already used everywhere else in the app, not an arbitrary new scheme.
  const scoreDistribution = [
    { bucket: "0-49", count: 0 },
    { bucket: "50-74", count: 0 },
    { bucket: "75-100", count: 0 },
  ];

  let scoreSum = 0;
  for (const candidate of candidates) {
    recommendationCounts[candidate.recommendation] += 1;
    scoreSum += candidate.match_score;
    if (candidate.match_score >= 75) {
      scoreDistribution[2].count += 1;
    } else if (candidate.match_score >= 50) {
      scoreDistribution[1].count += 1;
    } else {
      scoreDistribution[0].count += 1;
    }
  }

  const topCandidates = [...candidates].sort((a, b) => b.match_score - a.match_score).slice(0, 5);
  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return {
    totalJobs: jobsResult.count ?? 0,
    totalCandidates: candidates.length,
    averageScore: candidates.length > 0 ? Math.round(scoreSum / candidates.length) : null,
    recommendationCounts,
    scoreDistribution,
    topCandidates,
    recentCandidates,
  };
}
