import { useEffect, useState } from "react";
import { fetchAnalyses, ApiError } from "../lib/api";
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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">History</h1>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && analyses.length === 0 && (
        <p className="text-sm text-gray-500">
          No analyses yet. Run one from the Home page.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {analyses.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => onSelect(a.id)}
              className="flex w-full items-center justify-between rounded-md border border-gray-200 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <div>
                <p className="font-medium text-gray-900">{a.resume_filename}</p>
                <p className="text-sm text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreClasses(a.match_score)}`}
              >
                {a.match_score}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
