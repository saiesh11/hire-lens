export type Recommendation = "strong_match" | "possible_match" | "not_a_match";

export interface Criterion {
  name: string;
  weight: "required" | "preferred";
  score: number;
  notes: string;
}

export interface SkillMatrixEntry {
  skill: string;
  status: "present" | "partial" | "missing";
  evidence: string;
}

export interface EvidenceItem {
  point: string;
  evidence: string;
}

export interface AnalysisDetail {
  id: string;
  created_at: string;
  resume_text: string;
  resume_filename: string;
  jd_text: string;
  match_score: number;
  recommendation: Recommendation;
  criteria: Criterion[];
  skills_matrix: SkillMatrixEntry[];
  strengths: EvidenceItem[];
  gaps: EvidenceItem[];
  interview_questions: string[];
  summary: string;
}

export type AnalysisListItem = Pick<
  AnalysisDetail,
  "id" | "created_at" | "resume_filename" | "match_score" | "recommendation"
>;
