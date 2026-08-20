import { Badge } from "@/components/ui/badge";
import type { Recommendation } from "../lib/types";

const CONFIG: Record<Recommendation, { label: string; classes: string }> = {
  strong_match: {
    label: "Strong Match",
    classes: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  possible_match: {
    label: "Possible Match",
    classes: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  not_a_match: {
    label: "Not a Match",
    classes: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
};

export function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  const config = CONFIG[recommendation];
  return (
    <Badge variant="outline" className={`h-auto rounded-full px-3 py-1 text-sm font-semibold ${config.classes}`}>
      {config.label}
    </Badge>
  );
}
