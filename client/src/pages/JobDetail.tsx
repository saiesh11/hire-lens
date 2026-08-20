import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RecommendationBadge } from "../components/RecommendationBadge";
import { UploadForm } from "../components/UploadForm";
import { AnalyzingAnimation } from "../components/AnalyzingAnimation";
import { useApi, ApiError } from "../lib/api";
import type { JobDetail as JobDetailType } from "../lib/types";

interface JobDetailProps {
  jobId: string;
  onBack: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onJobDeleted: () => void;
}

function scoreClasses(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const candidatesRef = useRef<HTMLDivElement>(null);

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
  }, [jobId, refreshKey]);

  async function handleUpload(resume: File) {
    setIsSubmitting(true);
    setUploadError(null);
    try {
      await createCandidate(jobId, resume);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Something went wrong scoring this resume.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editTitle.trim() || !editJdText.trim()) return;
    setIsSaving(true);
    try {
      await updateJob(jobId, { title: editTitle.trim(), jdText: editJdText.trim() });
      setIsEditing(false);
      setRefreshKey((k) => k + 1);
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
      <Button variant="link" onClick={onBack} className="mb-6 h-auto p-0 text-sm font-medium text-indigo-600 hover:text-indigo-800">
        ← Back to Jobs
      </Button>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
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
                    <h1 className="text-xl font-bold tracking-tight text-gray-900">{job.title}</h1>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-auto rounded-lg px-3 py-1.5">
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteJob} className="h-auto rounded-lg px-3 py-1.5">
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">{job.jd_text}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="relative rounded-2xl shadow-sm">
            <CardContent>
              <h2 className="mb-4 text-base font-semibold text-gray-900">Add a Candidate</h2>
              <UploadForm onSubmit={handleUpload} isSubmitting={isSubmitting} submitLabel="Add Candidate" />
              {uploadError && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {uploadError}
                </p>
              )}
            </CardContent>
            {isSubmitting && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/90 backdrop-blur-sm">
                <AnalyzingAnimation />
              </div>
            )}
          </Card>

          <div ref={candidatesRef}>
            <h2 className="mb-4 text-xl font-bold tracking-tight text-gray-900">
              Candidates ({job.candidates.length})
            </h2>

            {job.candidates.length === 0 ? (
              <Card className="rounded-2xl border-dashed">
                <CardContent className="text-center">
                  <p className="text-sm text-gray-500">No candidates yet. Add a resume above.</p>
                </CardContent>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {job.candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => onSelectCandidate(c.id)}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md sm:p-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{c.resume_filename}</p>
                        <p className="text-sm text-gray-500">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
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
