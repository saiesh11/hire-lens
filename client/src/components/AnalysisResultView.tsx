import { ScoreGauge } from "./ScoreGauge";
import { StrengthsGapsList } from "./StrengthsGapsList";

interface AnalysisResultViewProps {
  matchScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export function AnalysisResultView({
  matchScore,
  summary,
  strengths,
  gaps,
}: AnalysisResultViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <ScoreGauge score={matchScore} />
      <p className="text-center text-gray-700">{summary}</p>
      <StrengthsGapsList strengths={strengths} gaps={gaps} />
    </div>
  );
}
