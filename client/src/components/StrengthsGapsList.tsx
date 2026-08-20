import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceItem } from "../lib/types";

interface StrengthsGapsListProps {
  strengths: EvidenceItem[];
  gaps: EvidenceItem[];
}

function EvidenceList({ items, emptyText }: { items: EvidenceItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="text-sm">
          <p className="font-medium">{item.point}</p>
          <p className="mt-0.5 text-xs opacity-75">{item.evidence}</p>
        </li>
      ))}
    </ul>
  );
}

export function StrengthsGapsList({ strengths, gaps }: StrengthsGapsListProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card className="rounded-2xl border-green-200 bg-green-50 text-green-900 shadow-sm dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300">
        <CardHeader>
          <CardTitle className="text-base text-green-800 dark:text-green-400">Strengths</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceList items={strengths} emptyText="No specific strengths identified." />
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        <CardHeader>
          <CardTitle className="text-base text-amber-800 dark:text-amber-400">Gaps</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceList items={gaps} emptyText="No significant gaps identified." />
        </CardContent>
      </Card>
    </div>
  );
}
