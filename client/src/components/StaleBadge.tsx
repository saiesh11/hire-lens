import { Badge } from "@/components/ui/badge";

export function StaleBadge() {
  return (
    <Badge
      variant="outline"
      title="Scored before the job description was last edited"
      className="h-auto rounded-full border-amber-300 bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    >
      Stale
    </Badge>
  );
}
