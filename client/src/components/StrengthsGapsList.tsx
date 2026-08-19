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
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900 shadow-sm">
        <h3 className="mb-3 font-semibold text-green-800">Strengths</h3>
        <EvidenceList items={strengths} emptyText="No specific strengths identified." />
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
        <h3 className="mb-3 font-semibold text-amber-800">Gaps</h3>
        <EvidenceList items={gaps} emptyText="No significant gaps identified." />
      </div>
    </div>
  );
}
