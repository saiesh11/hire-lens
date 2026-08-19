import { useState } from "react";
import { UploadForm } from "../components/UploadForm";
import { AnalysisResultView } from "../components/AnalysisResultView";
import { analyzeResume, ApiError } from "../lib/api";
import type { AnalysisDetail } from "../lib/types";

interface HomeProps {
  onAnalyzed: (analysis: AnalysisDetail) => void;
}

export function Home({ onAnalyzed }: HomeProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisDetail | null>(null);

  async function handleSubmit(resume: File, jobDescription: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const analysis = await analyzeResume(resume, jobDescription);
      setResult(analysis);
      onAnalyzed(analysis);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong analyzing your resume. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">HireLens</h1>
        <p className="mt-2 text-gray-600">
          Upload your resume and a job description to see how well you match.
        </p>
      </div>

      <UploadForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {isSubmitting && (
        <p className="text-center text-sm text-gray-500">
          Analyzing your resume against the job description...
        </p>
      )}

      {result && !isSubmitting && (
        <AnalysisResultView
          match_score={result.match_score}
          recommendation={result.recommendation}
          summary={result.summary}
          criteria={result.criteria}
          skills_matrix={result.skills_matrix}
          strengths={result.strengths}
          gaps={result.gaps}
          interview_questions={result.interview_questions}
        />
      )}
    </div>
  );
}
