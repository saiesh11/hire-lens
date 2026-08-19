import type { SkillMatrixEntry } from "../lib/types";

const STATUS_CONFIG: Record<SkillMatrixEntry["status"], { label: string; classes: string }> = {
  present: { label: "Present", classes: "bg-green-100 text-green-800" },
  partial: { label: "Partial", classes: "bg-amber-100 text-amber-800" },
  missing: { label: "Missing", classes: "bg-red-100 text-red-800" },
};

export function SkillsMatrixTable({ entries }: { entries: SkillMatrixEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">Skills Matrix</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 pr-4 font-medium">Skill</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const status = STATUS_CONFIG[entry.status];
              return (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-gray-800">{entry.skill}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.classes}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{entry.evidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
