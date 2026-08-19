import { ScoreGauge } from "./ScoreGauge";
import { RecommendationBadge } from "./RecommendationBadge";
import { CriteriaBreakdown } from "./CriteriaBreakdown";
import { SkillsMatrixTable } from "./SkillsMatrixTable";
import { StrengthsGapsList } from "./StrengthsGapsList";
import { InterviewQuestions } from "./InterviewQuestions";
import type { AnalysisDetail } from "../lib/types";

type AnalysisResultViewProps = Pick<
  AnalysisDetail,
  | "match_score"
  | "recommendation"
  | "summary"
  | "criteria"
  | "skills_matrix"
  | "strengths"
  | "gaps"
  | "interview_questions"
>;

export function AnalysisResultView({
  match_score,
  recommendation,
  summary,
  criteria,
  skills_matrix,
  strengths,
  gaps,
  interview_questions,
}: AnalysisResultViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ScoreGauge score={match_score} />
        <RecommendationBadge recommendation={recommendation} />
        <p className="mt-1 text-center text-gray-600">{summary}</p>
      </div>
      <CriteriaBreakdown criteria={criteria} />
      <SkillsMatrixTable entries={skills_matrix} />
      <StrengthsGapsList strengths={strengths} gaps={gaps} />
      <InterviewQuestions questions={interview_questions} />
    </div>
  );
}
