import { highlightTerms } from "../lib/highlightTerms";
import type { SkillMatrixEntry } from "../lib/types";

const MAX_LENGTH = 110;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

interface HighlightedSummaryProps {
  summary: string;
  skillsMatrix: SkillMatrixEntry[];
}

export function HighlightedSummary({ summary, skillsMatrix }: HighlightedSummaryProps) {
  const presentSkills = skillsMatrix.filter((s) => s.status === "present").map((s) => s.skill);
  const snippet = truncate(summary, MAX_LENGTH);
  const segments = highlightTerms(snippet, presentSkills);

  return (
    <p className="truncate text-sm text-muted-foreground">
      {segments.map((segment, i) =>
        typeof segment === "string" ? (
          <span key={i}>{segment}</span>
        ) : (
          <mark
            key={i}
            className="rounded-sm bg-indigo-100 px-0.5 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            {segment.term}
          </mark>
        ),
      )}
    </p>
  );
}
