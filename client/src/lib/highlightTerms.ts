// Splits `text` on any whole-word, case-insensitive match of the given
// terms, returning an array of plain strings and { term } markers a caller
// can render however it likes (e.g. wrapped in <mark>). Simple substring
// matching, not NLP — good enough for calling out skills already known to
// be present, not for general keyword extraction.
export type HighlightSegment = string | { term: string };

export function highlightTerms(text: string, terms: string[]): HighlightSegment[] {
  const cleanTerms = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (cleanTerms.length === 0 || !text) return [text];

  const escaped = cleanTerms
    .sort((a, b) => b.length - a.length) // longest first, so "Node.js" wins over "Node"
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push(text.slice(lastIndex, index));
    segments.push({ term: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) segments.push(text.slice(lastIndex));

  return segments;
}
