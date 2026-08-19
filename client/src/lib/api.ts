import type { AnalysisDetail, AnalysisListItem } from "./types";

export class ApiError extends Error {}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // response wasn't JSON — fall through to generic message
  }
  return `Request failed with status ${res.status}`;
}

export async function analyzeResume(
  resumeFile: File,
  jobDescription: string,
): Promise<AnalysisDetail> {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("jobDescription", jobDescription);

  const res = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res));
  }

  return res.json();
}

export async function fetchAnalyses(): Promise<AnalysisListItem[]> {
  const res = await fetch("/api/analyses");
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res));
  }
  return res.json();
}

export async function fetchAnalysis(id: string): Promise<AnalysisDetail> {
  const res = await fetch(`/api/analyses/${id}`);
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res));
  }
  return res.json();
}
