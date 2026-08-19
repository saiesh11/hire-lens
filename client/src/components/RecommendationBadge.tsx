import type { Recommendation } from "../lib/types";

const CONFIG: Record<Recommendation, { label: string; classes: string }> = {
  strong_match: { label: "Strong Match", classes: "bg-green-100 text-green-800 border-green-300" },
  possible_match: { label: "Possible Match", classes: "bg-amber-100 text-amber-800 border-amber-300" },
  not_a_match: { label: "Not a Match", classes: "bg-red-100 text-red-800 border-red-300" },
};

export function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  const config = CONFIG[recommendation];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
