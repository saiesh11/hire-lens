import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useApi, ApiError } from "../lib/api";
import type { JobListItem } from "../lib/types";

interface JobsProps {
  refreshKey: number;
  onSelect: (jobId: string) => void;
  onCreated: () => void;
}

export function Jobs({ refreshKey, onSelect, onCreated }: JobsProps) {
  const { createJob, listJobs } = useApi();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    listJobs()
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load jobs");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !jdText.trim()) {
      setCreateError("Please provide a job title and description");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const job = await createJob(title.trim(), jdText.trim());
      setTitle("");
      setJdText("");
      onCreated();
      onSelect(job.id);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create job");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">HireLens</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Create a job, then score as many candidate resumes against it as you like — ranked,
          explained, and backed by evidence.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-5">
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">
                Job Title
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
                placeholder="e.g. Senior Full-Stack Engineer"
                className="block w-full rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div>
              <label htmlFor="jd" className="mb-1.5 block text-sm font-medium text-foreground">
                Job Description
              </label>
              <Textarea
                id="jd"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                disabled={isCreating}
                rows={8}
                placeholder="Paste the job description here..."
                className="w-full resize-y rounded-xl p-3.5 text-sm shadow-sm"
              />
            </div>
            {createError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {createError}
              </p>
            )}
            <Button
              type="submit"
              disabled={isCreating}
              size="lg"
              className="h-auto w-full rounded-xl px-4 py-3 text-base font-medium shadow-sm hover:shadow"
            >
              {isCreating ? "Creating..." : "Create Job"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">Your Jobs</h2>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {loadError && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400" role="alert">
            {loadError}
          </p>
        )}

        {!isLoading && !loadError && jobs.length === 0 && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">No jobs yet. Create one above to get started.</p>
            </CardContent>
          </Card>
        )}

        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                onClick={() => onSelect(job.id)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md sm:p-5 dark:hover:border-indigo-700"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{job.title}</p>
                  <p className="text-sm text-muted-foreground">{new Date(job.created_at).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className="h-auto shrink-0 rounded-full border-transparent bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  {job.candidate_count} candidate{job.candidate_count === 1 ? "" : "s"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
