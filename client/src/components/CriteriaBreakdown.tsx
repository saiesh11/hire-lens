import type { Criterion } from "../lib/types";

function barColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function CriteriaBreakdown({ criteria }: { criteria: Criterion[] }) {
  if (criteria.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-4 font-semibold text-gray-900">Criteria Breakdown</h3>
      <div className="flex flex-col gap-4">
        {criteria.map((c, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{c.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.weight === "required"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {c.weight}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-700">{c.score}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${barColor(c.score)}`}
                style={{ width: `${c.score}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">{c.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
