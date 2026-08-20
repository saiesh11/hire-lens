import { Badge } from "@/components/ui/badge";
import type { GithubEnrichment } from "../lib/types";

export function GithubSummaryBadge({ enrichment }: { enrichment: GithubEnrichment }) {
  const topLanguage = enrichment.topLanguages[0]?.language;

  return (
    <Badge
      variant="outline"
      title="GitHub profile fetched for this candidate"
      className="h-auto rounded-full border-transparent bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
    >
      ★ {enrichment.totalStars}
      {topLanguage ? ` · ${topLanguage}` : ""}
    </Badge>
  );
}
