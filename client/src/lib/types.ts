export interface AnalysisDetail {
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
  AnalysisDetail,
  "id" | "created_at" | "resume_filename" | "match_score"
>;
