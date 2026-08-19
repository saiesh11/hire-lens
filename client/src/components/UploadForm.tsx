import { useState } from "react";
import type { FormEvent } from "react";

interface UploadFormProps {
  onSubmit: (resume: File, jobDescription: string) => void;
  isSubmitting: boolean;
}

export function UploadForm({ onSubmit, isSubmitting }: UploadFormProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
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
        <label htmlFor="resume" className="mb-1 block text-sm font-medium text-gray-700">
          Resume (PDF)
        </label>
        <input
          id="resume"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={isSubmitting}
          className="block w-full rounded-md border border-gray-300 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {resumeFile && (
          <p className="mt-1 text-sm text-gray-500">Selected: {resumeFile.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="jd" className="mb-1 block text-sm font-medium text-gray-700">
          Job Description
        </label>
        <textarea
          id="jd"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          disabled={isSubmitting}
          rows={10}
          placeholder="Paste the job description here..."
          className="block w-full rounded-md border border-gray-300 p-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
        className="rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
      >
        {isSubmitting ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
