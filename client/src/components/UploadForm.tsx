import { useRef, useState } from "react";
import type { FormEvent } from "react";

interface UploadFormProps {
  onSubmit: (resume: File, jobDescription: string) => void;
  isSubmitting: boolean;
}

export function UploadForm({ onSubmit, isSubmitting }: UploadFormProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function applyFile(file: File | null) {
    if (file && file.type !== "application/pdf") {
      setValidationError("Please upload a PDF file");
      setResumeFile(null);
      return;
    }
    setValidationError(null);
    setResumeFile(file);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resumeFile) {
      setValidationError("Please upload your resume as a PDF");
      return;
    }
    if (!jobDescription.trim()) {
      setValidationError("Please paste the job description");
      return;
    }
    setValidationError(null);
    onSubmit(resumeFile, jobDescription.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Resume (PDF)</label>
        <input
          ref={fileInputRef}
          id="resume"
          type="file"
          accept="application/pdf"
          onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
          disabled={isSubmitting}
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
            applyFile(e.dataTransfer.files?.[0] ?? null);
          }}
          disabled={isSubmitting}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            isDragging
              ? "border-indigo-400 bg-indigo-50"
              : resumeFile
                ? "border-indigo-200 bg-indigo-50/50"
                : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-indigo-500" fill="none">
            <path
              d="M12 16V4m0 0L7 9m5-5l5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {resumeFile ? (
            <span className="text-sm font-medium text-indigo-700">{resumeFile.name}</span>
          ) : (
            <span className="text-sm text-gray-500">
              <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop a PDF
            </span>
          )}
        </button>
      </div>

      <div>
        <label htmlFor="jd" className="mb-1.5 block text-sm font-medium text-gray-700">
          Job Description
        </label>
        <textarea
          id="jd"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          disabled={isSubmitting}
          rows={10}
          placeholder="Paste the job description here..."
          className="block w-full rounded-xl border border-gray-300 bg-white p-3.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {validationError && (
        <p className="text-sm text-red-600" role="alert">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-indigo-700 hover:shadow disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:shadow-none"
      >
        {isSubmitting ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
