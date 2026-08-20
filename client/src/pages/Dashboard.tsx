import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, ApiError } from "../lib/api";
import type { DashboardCandidate, DashboardSummary, Recommendation } from "../lib/types";

interface DashboardProps {
  refreshKey: number;
  onSelectCandidate: (candidateId: string, jobId: string) => void;
  onCreateJob: () => void;
}

// Same red/amber/green vocabulary already used by ScoreGauge's scoreColor()
// and JobDetail's scoreClasses() — ties this chart's meaning to colors the
// rest of the app already uses, not an arbitrary new palette.
const SCORE_COLORS = ["#dc2626", "#d97706", "#16a34a"];
const RECOMMENDATION_COLORS: Record<Recommendation, string> = {
  strong_match: "#16a34a",
  possible_match: "#d97706",
  not_a_match: "#dc2626",
};
const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_match: "Strong Match",
  possible_match: "Possible Match",
  not_a_match: "Not a Match",
};

function scoreBadgeClasses(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (score >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

function CandidateRow({
  candidate,
  onSelect,
}: {
  candidate: DashboardCandidate;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {candidate.candidate_name ?? candidate.resume_filename}
        </p>
        <p className="truncate text-xs text-muted-foreground">{candidate.job_title}</p>
      </div>
      <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClasses(candidate.match_score)}`}>
        {candidate.match_score}
      </span>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

export function Dashboard({ refreshKey, onSelectCandidate, onCreateJob }: DashboardProps) {
  const { getDashboardSummary } = useApi();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getDashboardSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load the dashboard");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const recommendationData = summary
    ? (Object.keys(summary.recommendationCounts) as Recommendation[])
        .map((key) => ({ key, label: RECOMMENDATION_LABELS[key], value: summary.recommendationCounts[key] }))
        .filter((entry) => entry.value > 0)
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">An overview of your hiring activity.</p>
      </div>

      {isLoading && <DashboardSkeleton />}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {summary && !isLoading && summary.totalJobs === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No jobs yet — create your first job to start seeing hiring stats here.
            </p>
            <Button onClick={onCreateJob} size="sm" className="h-auto rounded-lg px-4 py-2">
              Create a Job
            </Button>
          </CardContent>
        </Card>
      )}

      {summary && !isLoading && summary.totalJobs > 0 && (
        <div className="flex flex-col gap-6" style={{ animation: "hl-fade-up 0.3s ease-out" }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl shadow-sm">
              <CardContent>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{summary.totalJobs}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent>
                <p className="text-sm text-muted-foreground">Total Candidates</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{summary.totalCandidates}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="mt-1 text-3xl font-bold text-foreground">
                  {summary.averageScore ?? "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {summary.totalCandidates > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Recommendation Split</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={recommendationData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {recommendationData.map((entry) => (
                          <Cell key={entry.key} fill={RECOMMENDATION_COLORS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
                      <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={summary.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="bucket" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {summary.scoreDistribution.map((entry, i) => (
                          <Cell key={entry.bucket} fill={SCORE_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {summary.topCandidates.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Top Candidates</h2>
                <Badge variant="outline" className="rounded-full border-transparent bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  across all jobs
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {summary.topCandidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    onSelect={() => onSelectCandidate(candidate.id, candidate.job_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {summary.recentCandidates.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Recent Activity</h2>
              <div className="flex flex-col gap-2">
                {summary.recentCandidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    onSelect={() => onSelectCandidate(candidate.id, candidate.job_id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
