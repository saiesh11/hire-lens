import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApi, ApiError } from "../lib/api";
import { AnalysisResultView } from "../components/AnalysisResultView";
import type { CandidateDetail as CandidateDetailType } from "../lib/types";

interface CandidateDetailProps {
  candidateId: string;
  onBack: () => void;
}

export function CandidateDetail({ candidateId, onBack }: CandidateDetailProps) {
  const { getCandidate, deleteCandidate } = useApi();
  const [candidate, setCandidate] = useState<CandidateDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getCandidate(candidateId)
      .then((data) => {
        if (!cancelled) setCandidate(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load this candidate");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  async function handleDelete() {
    if (!window.confirm("Remove this candidate? This can't be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteCandidate(candidateId);
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete this candidate");
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="link"
          onClick={onBack}
          className="h-auto p-0 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          ← Back to Job
        </Button>
        {candidate && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-auto rounded-lg px-3 py-1.5"
          >
            {isDeleting ? "Removing..." : "Remove Candidate"}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {candidate && !isLoading && (
        <div className="flex flex-col gap-6" style={{ animation: "hl-fade-up 0.3s ease-out" }}>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">{candidate.resume_filename}</h1>
            <p className="text-sm text-gray-500">
              {new Date(candidate.created_at).toLocaleString()}
            </p>
          </div>
          <AnalysisResultView
            match_score={candidate.match_score}
            recommendation={candidate.recommendation}
            summary={candidate.summary}
            criteria={candidate.criteria}
            skills_matrix={candidate.skills_matrix}
            strengths={candidate.strengths}
            gaps={candidate.gaps}
            interview_questions={candidate.interview_questions}
          />
        </div>
      )}
    </div>
  );
}
