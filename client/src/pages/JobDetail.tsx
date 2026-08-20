import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecommendationBadge } from "../components/RecommendationBadge";
import { StaleBadge } from "../components/StaleBadge";
import { BulkUploadForm } from "../components/BulkUploadForm";
import { useApi, ApiError } from "../lib/api";
import { getDefaultSort } from "../lib/preferences";
import { SORT_LABELS, isCandidateStale } from "../lib/types";
import type { JobDetail as JobDetailType, Recommendation, SortOption } from "../lib/types";

interface JobDetailProps {
  jobId: string;
  onBack: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onJobDeleted: () => void;
}

const RECOMMENDATION_RANK: Record<Recommendation, number> = {
  strong_match: 0,
  possible_match: 1,
  not_a_match: 2,
};

function scoreClasses(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (score >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

function rankClasses(rank: number): string {
  if (rank === 1) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  if (rank === 2) return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  if (rank === 3) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
}

export function JobDetail({ jobId, onBack, onSelectCandidate, onJobDeleted }: JobDetailProps) {
  const { getJob, updateJob, deleteJob, createCandidate } = useApi();
  const [job, setJob] = useState<JobDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editJdText, setEditJdText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [sortOption, setSortOption] = useState<SortOption>(getDefaultSort);
  const candidatesRef = useRef<HTMLDivElement>(null);

  // Silent background refresh — re-fetches the job without touching isLoading,
  // so the page (and the in-progress BulkUploadForm's queue) never unmounts.
  // Bumping a refreshKey through the loading effect below would hide the whole
  // page between every candidate upload, wiping BulkUploadForm's local state.
  async function refreshJob() {
    try {
      const data = await getJob(jobId);
      setJob(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to refresh this job");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getJob(jobId)
      .then((data) => {
        if (!cancelled) {
          setJob(data);
          setEditTitle(data.title);
          setEditJdText(data.jd_text);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load this job");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const sortedCandidates = useMemo(() => {
    if (!job) return [];
    return [...job.candidates].sort((a, b) => {
      switch (sortOption) {
        case "score-desc":
          return b.match_score - a.match_score;
        case "score-asc":
          return a.match_score - b.match_score;
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "recommendation":
          return RECOMMENDATION_RANK[a.recommendation] - RECOMMENDATION_RANK[b.recommendation];
      }
    });
  }, [job, sortOption]);

  async function handleSaveEdit() {
    if (!editTitle.trim() || !editJdText.trim()) return;
    setIsSaving(true);
    try {
      await updateJob(jobId, { title: editTitle.trim(), jdText: editJdText.trim() });
      setIsEditing(false);
      await refreshJob();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteJob() {
    if (!window.confirm("Delete this job and all its candidates? This can't be undone.")) return;
    try {
      await deleteJob(jobId);
      onJobDeleted();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete job");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Button variant="link" onClick={onBack} className="mb-6 h-auto p-0 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
        ← Back to Jobs
      </Button>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400" role="alert">
          {loadError}
        </p>
      )}

      {job && !isLoading && (
        <div className="flex flex-col gap-6" style={{ animation: "hl-fade-up 0.3s ease-out" }}>
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              {isEditing ? (
                <div className="flex flex-col gap-4">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="block w-full rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-lg font-bold shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <Textarea
                    value={editJdText}
                    onChange={(e) => setEditJdText(e.target.value)}
                    rows={8}
                    className="w-full resize-y rounded-xl p-3.5 text-sm shadow-sm"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} disabled={isSaving} className="h-auto rounded-xl px-4 py-2">
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditTitle(job.title);
                        setEditJdText(job.jd_text);
                      }}
                      className="h-auto rounded-xl px-4 py-2"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <h1 className="text-xl font-bold tracking-tight text-foreground">{job.title}</h1>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-auto rounded-lg px-3 py-1.5">
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteJob} className="h-auto rounded-lg px-3 py-1.5">
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{job.jd_text}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <h2 className="mb-4 text-base font-semibold text-foreground">Add Candidates</h2>
              <BulkUploadForm
                onUploadFile={(file) => createCandidate(jobId, file)}
                onCandidateAdded={refreshJob}
              />
            </CardContent>
          </Card>

          <div ref={candidatesRef}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Candidates ({job.candidates.length})
              </h2>
              {job.candidates.length > 1 && (
                <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                  <SelectTrigger className="w-[190px] rounded-lg" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {SORT_LABELS[opt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {sortedCandidates.length === 0 ? (
              <Card className="rounded-2xl border-dashed">
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground">No candidates yet. Add resumes above.</p>
                </CardContent>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {sortedCandidates.map((c, i) => (
                  <li key={c.id}>
                    <button
                      onClick={() => onSelectCandidate(c.id)}
                      className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md sm:p-5 dark:hover:border-indigo-700"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankClasses(i + 1)}`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{c.resume_filename}</p>
                        <p className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {isCandidateStale(c.scored_at, job.jd_updated_at) && <StaleBadge />}
                        <RecommendationBadge recommendation={c.recommendation} />
                        <span className={`inline-flex h-5 items-center rounded-full px-3 py-1 text-sm font-semibold ${scoreClasses(c.match_score)}`}>
                          {c.match_score}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
