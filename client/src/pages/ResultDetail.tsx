import { useEffect, useState } from "react";
import { fetchAnalysis, ApiError } from "../lib/api";
import { AnalysisResultView } from "../components/AnalysisResultView";
import type { AnalysisDetail } from "../lib/types";

interface ResultDetailProps {
  id: string;
  onBack: () => void;
}

export function ResultDetail({ id, onBack }: ResultDetailProps) {
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchAnalysis(id)
      .then((data) => {
        if (!cancelled) setAnalysis(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load this analysis",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <button
        onClick={onBack}
        className="mb-6 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        ← Back to History
      </button>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {analysis && !isLoading && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{analysis.resume_filename}</h1>
            <p className="text-sm text-gray-500">
              {new Date(analysis.created_at).toLocaleString()}
            </p>
          </div>
          <AnalysisResultView
            match_score={analysis.match_score}
            recommendation={analysis.recommendation}
            summary={analysis.summary}
            criteria={analysis.criteria}
            skills_matrix={analysis.skills_matrix}
            strengths={analysis.strengths}
            gaps={analysis.gaps}
            interview_questions={analysis.interview_questions}
          />
        </div>
      )}
    </div>
  );
}
