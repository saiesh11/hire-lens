import { useAuth } from "@clerk/clerk-react";
import type { CandidateDetail, JobDetail, JobListItem } from "./types";

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

  async function jsonHeader(): Promise<HeadersInit> {
    return { ...(await authHeader()), "Content-Type": "application/json" };
  }

  async function createJob(title: string, jdText: string): Promise<JobDetail> {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: await jsonHeader(),
      body: JSON.stringify({ title, jdText }),
    });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
    const job = await res.json();
    return { ...job, candidates: [] };
  }

  async function listJobs(): Promise<JobListItem[]> {
    const res = await fetch("/api/jobs", { headers: await authHeader() });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
    return res.json();
  }

  async function getJob(id: string): Promise<JobDetail> {
    const res = await fetch(`/api/jobs/${id}`, { headers: await authHeader() });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
    return res.json();
  }

  async function updateJob(
    id: string,
    updates: { title?: string; jdText?: string },
  ): Promise<JobDetail> {
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: await jsonHeader(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
    return res.json();
  }

  async function deleteJob(id: string): Promise<void> {
    const res = await fetch(`/api/jobs/${id}`, {
      method: "DELETE",
      headers: await authHeader(),
    });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
  }

  async function createCandidate(jobId: string, resumeFile: File): Promise<CandidateDetail> {
    const formData = new FormData();
    formData.append("resume", resumeFile);

    const res = await fetch(`/api/jobs/${jobId}/candidates`, {
      method: "POST",
      headers: await authHeader(),
      body: formData,
    });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
    return res.json();
  }

  async function getCandidate(id: string): Promise<CandidateDetail> {
    const res = await fetch(`/api/candidates/${id}`, { headers: await authHeader() });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
    return res.json();
  }

  async function deleteCandidate(id: string): Promise<void> {
    const res = await fetch(`/api/candidates/${id}`, {
      method: "DELETE",
      headers: await authHeader(),
    });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
  }

  async function reanalyzeCandidate(id: string): Promise<CandidateDetail> {
    const res = await fetch(`/api/candidates/${id}/reanalyze`, {
      method: "POST",
      headers: await authHeader(),
    });
    if (!res.ok) throw new ApiError(await parseErrorMessage(res));
    return res.json();
  }

  return {
    createJob,
    listJobs,
    getJob,
    updateJob,
    deleteJob,
    createCandidate,
    getCandidate,
    deleteCandidate,
    reanalyzeCandidate,
  };
}
