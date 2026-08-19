import { useAuth } from "@clerk/clerk-react";
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

/**
 * Every request needs the signed-in user's Clerk session token attached, so
 * these functions are exposed as a hook rather than plain exports — getToken()
 * is only available inside a component under <ClerkProvider>.
 */
export function useApi() {
  const { getToken } = useAuth();

  async function authHeader(): Promise<HeadersInit> {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function analyzeResume(resumeFile: File, jobDescription: string): Promise<AnalysisDetail> {
    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("jobDescription", jobDescription);

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: await authHeader(),
      body: formData,
    });

    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res));
    }
    return res.json();
  }

  async function fetchAnalyses(): Promise<AnalysisListItem[]> {
    const res = await fetch("/api/analyses", { headers: await authHeader() });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res));
    }
    return res.json();
  }

  async function fetchAnalysis(id: string): Promise<AnalysisDetail> {
    const res = await fetch(`/api/analyses/${id}`, { headers: await authHeader() });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res));
    }
    return res.json();
  }

  return { analyzeResume, fetchAnalyses, fetchAnalysis };
}
