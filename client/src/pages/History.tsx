import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApi, ApiError } from "../lib/api";
import { RecommendationBadge } from "../components/RecommendationBadge";
import type { AnalysisListItem } from "../lib/types";

interface HistoryProps {
  onSelect: (id: string) => void;
  refreshKey: number;
}

function scoreClasses(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export function History({ onSelect, refreshKey }: HistoryProps) {
  const { fetchAnalyses } = useApi();
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchAnalyses()
      .then((data) => {
        if (!cancelled) setAnalyses(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load history",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">History</h1>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && analyses.length === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="text-center">
            <p className="text-sm text-gray-500">No analyses yet. Run one from the Home page.</p>
          </CardContent>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {analyses.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => onSelect(a.id)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md sm:p-5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{a.resume_filename}</p>
                <p className="text-sm text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <RecommendationBadge recommendation={a.recommendation} />
                <Badge variant="outline" className={`h-auto rounded-full border-transparent px-3 py-1 text-sm font-semibold ${scoreClasses(a.match_score)}`}>
                  {a.match_score}
                </Badge>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
