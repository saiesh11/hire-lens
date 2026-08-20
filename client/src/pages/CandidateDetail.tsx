import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { useApi, ApiError } from "../lib/api";
import { AnalysisResultView } from "../components/AnalysisResultView";
import { StaleBadge } from "../components/StaleBadge";
import { isCandidateStale } from "../lib/types";
import type { CandidateDetail as CandidateDetailType } from "../lib/types";

interface CandidateDetailProps {
  candidateId: string;
  onBack: () => void;
}

export function CandidateDetail({ candidateId, onBack }: CandidateDetailProps) {
  const { getCandidate, deleteCandidate, reanalyzeCandidate } = useApi();
  const { has } = useAuth();
  const isAdmin = has?.({ role: "org:admin" }) ?? false;
  const [candidate, setCandidate] = useState<CandidateDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

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

  async function handleReanalyze() {
    setIsReanalyzing(true);
    setError(null);
    try {
      const updated = await reanalyzeCandidate(candidateId);
      setCandidate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to re-analyze this candidate");
    } finally {
      setIsReanalyzing(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="link"
          onClick={onBack}
          className="h-auto p-0 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to Job
        </Button>
        {candidate && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={isReanalyzing || isDeleting || !candidate.resume_storage_path}
              title={
                !candidate.resume_storage_path
                  ? "Original resume file isn't available — remove and re-upload to enable re-analysis"
                  : undefined
              }
              className="h-auto rounded-lg px-3 py-1.5"
            >
              {isReanalyzing ? "Re-analyzing..." : "Re-analyze"}
            </Button>
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting || isReanalyzing}
                className="h-auto rounded-lg px-3 py-1.5"
              >
                {isDeleting ? "Removing..." : "Remove Candidate"}
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {candidate && !isLoading && (
        <div className="flex flex-col gap-6" style={{ animation: "hl-fade-up 0.3s ease-out" }}>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{candidate.resume_filename}</h1>
              {isCandidateStale(candidate.scored_at, candidate.job_jd_updated_at) && <StaleBadge />}
            </div>
            <p className="text-sm text-muted-foreground">
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
