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
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "../lib/api";
import { useCachedResource } from "../lib/useCachedResource";
import type { DashboardSummary, Recommendation } from "../lib/types";

interface DashboardProps {
  refreshKey: number;
  onCreateJob: () => void;
}

// Same red/amber/green vocabulary already used by ScoreGauge's scoreColor()
// and JobDetail's scoreClasses() — ties this chart's meaning to colors the
// rest of the app already uses, not an arbitrary new palette. Rendered as
// gradients (see GRADIENT_DEFS) rather than flat fills for more visual depth,
// without introducing any new hues.
const SCORE_COLORS = ["url(#hlGradRed)", "url(#hlGradAmber)", "url(#hlGradGreen)"];
const RECOMMENDATION_GRADIENTS: Record<Recommendation, string> = {
  strong_match: "url(#hlGradGreen)",
  possible_match: "url(#hlGradAmber)",
  not_a_match: "url(#hlGradRed)",
};
const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_match: "Strong Match",
  possible_match: "Possible Match",
  not_a_match: "Not a Match",
};

function bucketForScore(score: number): string {
  if (score >= 75) return "75-100";
  if (score >= 50) return "50-74";
  return "0-49";
}

// Card-level tints, restrained (not the gradient/glow treatment competitor
// sites use) — indigo for general stats, the same red/amber/green
// score-meaning colors used everywhere else in the app for the one card
// whose value directly reflects score quality.
const INDIGO_CARD = "border-indigo-100 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20";

function averageScoreCardClasses(score: number | null): string {
  if (score === null) return "";
  if (score >= 75) return "border-green-100 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20";
  if (score >= 50) return "border-amber-100 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20";
  return "border-red-100 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20";
}

// Shared gradient defs, duplicated per chart (gradient url() refs only
// resolve within the same <svg> — each ResponsiveContainer renders its own).
function GradientDefs() {
  return (
    <defs>
      <linearGradient id="hlGradGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="100%" stopColor="#15803d" />
      </linearGradient>
      <linearGradient id="hlGradAmber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="hlGradRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f87171" />
        <stop offset="100%" stopColor="#b91c1c" />
      </linearGradient>
    </defs>
  );
}

// Same easing/animation pattern as ScoreGauge's animated number, for a
// consistent feel wherever a number counts up in this app.
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
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
    </div>
  );
}

function RecommendationDonut({ summary }: { summary: DashboardSummary }) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = useCountUp(summary.totalCandidates);

  const recommendationData = (Object.keys(summary.recommendationCounts) as Recommendation[])
    .map((key) => ({ key, label: RECOMMENDATION_LABELS[key], value: summary.recommendationCounts[key] }))
    .filter((entry) => entry.value > 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <GradientDefs />
          <Pie
            data={recommendationData}
            dataKey="value"
            nameKey="label"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            animationDuration={900}
            animationEasing="ease-out"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
          >
            {recommendationData.map((entry, i) => (
              <Cell
                key={entry.key}
                fill={RECOMMENDATION_GRADIENTS[entry.key]}
                stroke="var(--card)"
                strokeWidth={2}
                opacity={activeIndex === undefined || activeIndex === i ? 1 : 0.45}
                style={{ transition: "opacity 150ms ease-out" }}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-7">
        <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
        <span className="text-xs text-muted-foreground">total</span>
      </div>
    </div>
  );
}

export function Dashboard({ refreshKey, onCreateJob }: DashboardProps) {
  const { getDashboardSummary } = useApi();
  const { data: summary, isLoading, error } = useCachedResource<DashboardSummary>(
    "dashboard",
    getDashboardSummary,
    [refreshKey],
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display text-foreground">Dashboard</h1>
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
            <Card className={`rounded-2xl shadow-sm ${INDIGO_CARD}`}>
              <CardContent>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{summary.totalJobs}</p>
              </CardContent>
            </Card>
            <Card className={`rounded-2xl shadow-sm ${INDIGO_CARD}`}>
              <CardContent>
                <p className="text-sm text-muted-foreground">Total Candidates</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{summary.totalCandidates}</p>
              </CardContent>
            </Card>
            <Card className={`rounded-2xl shadow-sm ${averageScoreCardClasses(summary.averageScore)}`}>
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
                  <RecommendationDonut summary={summary} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={summary.scoreDistribution}>
                      <GradientDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="bucket" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={700} animationEasing="ease-out">
                        {summary.scoreDistribution.map((entry, i) => (
                          <Cell key={entry.bucket} fill={SCORE_COLORS[i]} />
                        ))}
                      </Bar>
                      {summary.averageScore !== null && (
                        <ReferenceLine
                          x={bucketForScore(summary.averageScore)}
                          stroke="var(--foreground)"
                          strokeDasharray="4 4"
                          label={{ value: `Avg ${summary.averageScore}`, position: "top", fill: "var(--foreground)", fontSize: 12 }}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
