interface StrengthsGapsListProps {
  strengths: string[];
  gaps: string[];
}

export function StrengthsGapsList({ strengths, gaps }: StrengthsGapsListProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h3 className="mb-3 font-semibold text-green-800">Strengths</h3>
        {strengths.length === 0 ? (
          <p className="text-sm text-green-700">No specific strengths identified.</p>
        ) : (
          <ul className="space-y-2">
            {strengths.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-green-900">
                <span aria-hidden className="text-green-600">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="mb-3 font-semibold text-amber-800">Gaps</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-amber-700">No significant gaps identified.</p>
        ) : (
          <ul className="space-y-2">
            {gaps.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-900">
                <span aria-hidden className="text-amber-600">!</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
