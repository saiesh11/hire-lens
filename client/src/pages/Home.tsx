import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { UploadForm } from "../components/UploadForm";
import { AnalysisResultView } from "../components/AnalysisResultView";
import { AnalyzingAnimation } from "../components/AnalyzingAnimation";
import { useApi, ApiError } from "../lib/api";
import type { AnalysisDetail } from "../lib/types";

interface HomeProps {
  onAnalyzed: (analysis: AnalysisDetail) => void;
}

export function Home({ onAnalyzed }: HomeProps) {
  const { analyzeResume } = useApi();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisDetail | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function handleSubmit(resume: File, jobDescription: string) {
    setIsSubmitting(true);
    setError(null);
    setResult(null);
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
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">HireLens</h1>
        <p className="mt-3 text-base text-gray-500">
          Upload a resume and a job description to see how well they match — scored, explained,
          and backed by evidence.
        </p>
      </div>

      <Card className="relative rounded-2xl shadow-sm [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
        <CardContent>
          <UploadForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </CardContent>

        {isSubmitting && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/90 backdrop-blur-sm"
            style={{ animation: "hl-fade-up 0.25s ease-out" }}
          >
            <AnalyzingAnimation />
          </div>
        )}
      </Card>

      {error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
          style={{ animation: "hl-fade-up 0.25s ease-out" }}
        >
          {error}
        </p>
      )}

      {result && !isSubmitting && (
        <div ref={resultRef} style={{ animation: "hl-fade-up 0.4s ease-out", scrollMarginTop: "80px" }}>
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
        </div>
      )}
    </div>
  );
}
