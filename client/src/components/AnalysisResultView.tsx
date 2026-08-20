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
  const topReasons = strengths.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl shadow-sm [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
        <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <ScoreGauge score={match_score} />
            <RecommendationBadge recommendation={recommendation} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:pt-2 sm:text-left">
            {topReasons.length > 0 && (
              <ul className="flex flex-col gap-2">
                {topReasons.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                    <span className="text-left">{item.point}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={`text-sm text-muted-foreground ${topReasons.length > 0 ? "mt-4" : ""}`}>{summary}</p>
          </div>
        </CardContent>
      </Card>
      <CriteriaBreakdown criteria={criteria} />
      <SkillsMatrixTable entries={skills_matrix} />
      <StrengthsGapsList strengths={strengths} gaps={gaps} />
      <InterviewQuestions questions={interview_questions} />
    </div>
  );
}
