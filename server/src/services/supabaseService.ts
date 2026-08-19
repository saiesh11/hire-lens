import { supabase } from "../lib/supabase.js";
import type { AnalysisResult } from "../schemas.js";

export interface AnalysisRow {
  id: string;
  created_at: string;
  resume_text: string;
  resume_filename: string;
  jd_text: string;
  match_score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
}

export type AnalysisListItem = Pick<
  AnalysisRow,
  "id" | "created_at" | "resume_filename" | "match_score"
>;

export class SupabaseServiceError extends Error {}

export async function saveAnalysis(input: {
  resumeText: string;
  resumeFilename: string;
  jdText: string;
  result: AnalysisResult;
}): Promise<AnalysisRow> {
  const { data, error } = await supabase
    .from("analyses")
    .insert({
      resume_text: input.resumeText,
      resume_filename: input.resumeFilename,
      jd_text: input.jdText,
      match_score: input.result.matchScore,
      strengths: input.result.strengths,
      gaps: input.result.gaps,
      summary: input.result.summary,
    })
    .select()
    .single();

  if (error || !data) {
    throw new SupabaseServiceError(error?.message ?? "Failed to save analysis");
  }

  return data as AnalysisRow;
}

export async function listAnalyses(): Promise<AnalysisListItem[]> {
  const { data, error } = await supabase
    .from("analyses")
    .select("id, created_at, resume_filename, match_score")
    .order("created_at", { ascending: false });

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data ?? [];
}

export async function getAnalysisById(id: string): Promise<AnalysisRow | null> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as AnalysisRow | null;
}
