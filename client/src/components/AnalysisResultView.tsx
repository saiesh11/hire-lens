import { Card, CardContent } from "@/components/ui/card";
import { ScoreGauge } from "./ScoreGauge";
import { RecommendationBadge } from "./RecommendationBadge";
import { CriteriaBreakdown } from "./CriteriaBreakdown";
import { SkillsMatrixTable } from "./SkillsMatrixTable";
import { StrengthsGapsList } from "./StrengthsGapsList";
import { InterviewQuestions } from "./InterviewQuestions";
import type { CandidateDetail } from "../lib/types";

type AnalysisResultViewProps = Pick<
  CandidateDetail,
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
      <Card className="rounded-2xl shadow-sm [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
        <CardContent className="flex flex-col items-center gap-3">
          <ScoreGauge score={match_score} />
          <RecommendationBadge recommendation={recommendation} />
          <p className="mt-1 text-center text-muted-foreground">{summary}</p>
        </CardContent>
      </Card>
      <CriteriaBreakdown criteria={criteria} />
      <SkillsMatrixTable entries={skills_matrix} />
      <StrengthsGapsList strengths={strengths} gaps={gaps} />
      <InterviewQuestions questions={interview_questions} />
    </div>
  );
}
