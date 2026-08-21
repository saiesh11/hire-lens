import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CandidateDetail } from "../lib/types";

interface FileEntry {
  id: string;
  file: File;
  status: "queued" | "scoring" | "done" | "failed";
  error?: string;
  score?: number;
}

interface BulkUploadFormProps {
  onUploadFile: (file: File) => Promise<CandidateDetail>;
  onCandidateAdded: () => void;
}

let nextId = 0;

export function BulkUploadForm({ onUploadFile, onCandidateAdded }: BulkUploadFormProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[] | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const nonPdf = incoming.find((f) => f.type !== "application/pdf");
    if (nonPdf) {
      setValidationError(`"${nonPdf.name}" isn't a PDF — only PDF resumes are accepted`);
      return;
    }
    setValidationError(null);
    setEntries((prev) => [
      ...prev,
      ...incoming.map((file) => ({ id: String(nextId++), file, status: "queued" as const })),
    ]);
  }

  async function processEntry(entry: FileEntry) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: "scoring", error: undefined } : e)));
    try {
      const candidate = await onUploadFile(entry.file);
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: "done", score: candidate.match_score } : e)),
      );
      onCandidateAdded();
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: "failed", error: err instanceof Error ? err.message : "Failed to score this resume" }
            : e,
        ),
      );
    }
  }

  // isProcessing (state) gates the buttons' `disabled` attribute, but state
  // updates aren't synchronous — two clicks close enough together can both
  // invoke handleStart/handleRetry before the first one's disabled state
  // actually commits, each independently submitting the same queued files.
  // This ref closes that race: it updates immediately, so a second call in
  // the same tick sees it's already busy and bails out before doing anything.
  const isBusyRef = useRef(false);

  async function handleStart() {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setIsProcessing(true);
    const queued = entries.filter((e) => e.status === "queued");
    for (const entry of queued) {
      await processEntry(entry);
    }
    setIsProcessing(false);
    isBusyRef.current = false;
  }

  async function handleRetry(entry: FileEntry) {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setIsProcessing(true);
    await processEntry(entry);
    setIsProcessing(false);
    isBusyRef.current = false;
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const hasQueued = entries.some((e) => e.status === "queued");

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
        disabled={isProcessing}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        disabled={isProcessing}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragging
            ? "border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/30"
            : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-indigo-500 dark:text-indigo-400" fill="none">
          <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-indigo-600 dark:text-indigo-400">Click to upload</span> or drag and drop one or more PDFs
        </span>
      </button>

      {validationError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {validationError}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
            >
              <span className="min-w-0 truncate text-sm text-foreground">{entry.file.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                {entry.status === "queued" && <Badge variant="secondary">Queued</Badge>}
                {entry.status === "scoring" && (
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    Scoring...
                  </Badge>
                )}
                {entry.status === "done" && (
                  <Badge variant="outline" className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    Score {entry.score}
                  </Badge>
                )}
                {entry.status === "failed" && (
                  <>
                    <span className="max-w-[16rem] truncate text-xs text-red-600 dark:text-red-400" title={entry.error}>
                      {entry.error}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(entry)}
                      disabled={isProcessing}
                      className="h-auto rounded-lg px-2.5 py-1 text-xs"
                    >
                      Retry
                    </Button>
                  </>
                )}
                {entry.status === "queued" && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    disabled={isProcessing}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    aria-label={`Remove ${entry.file.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasQueued && (
        <Button
          type="button"
          onClick={handleStart}
          disabled={isProcessing}
          size="lg"
          className="h-auto w-full rounded-xl px-4 py-3 text-base font-medium shadow-sm hover:shadow"
        >
          {isProcessing ? "Scoring candidates..." : `Add ${entries.filter((e) => e.status === "queued").length} Candidate${entries.filter((e) => e.status === "queued").length === 1 ? "" : "s"}`}
        </Button>
      )}
    </div>
  );
}
