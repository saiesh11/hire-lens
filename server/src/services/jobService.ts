import { supabase } from "../lib/supabase.js";

export interface JobRow {
  id: string;
  user_id: string;
  created_at: string;
  title: string;
  jd_text: string;
}

export interface JobListItem {
  id: string;
  created_at: string;
  title: string;
  candidate_count: number;
}

export class SupabaseServiceError extends Error {}

export async function createJob(input: {
  userId: string;
  title: string;
  jdText: string;
}): Promise<JobRow> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({ user_id: input.userId, title: input.title, jd_text: input.jdText })
    .select()
    .single();

  if (error || !data) {
    throw new SupabaseServiceError(error?.message ?? "Failed to create job");
  }

  return data as JobRow;
}

export async function listJobs(userId: string): Promise<JobListItem[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, created_at, title, candidates(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return (data ?? []).map((row) => {
    const countRow = Array.isArray(row.candidates) ? row.candidates[0] : undefined;
    return {
      id: row.id,
      created_at: row.created_at,
      title: row.title,
      candidate_count: (countRow as { count?: number } | undefined)?.count ?? 0,
    };
  });
}

export async function getJobById(id: string, userId: string): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, user_id, created_at, title, jd_text")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as JobRow | null;
}

export async function updateJob(
  id: string,
  userId: string,
  updates: { title?: string; jdText?: string },
): Promise<JobRow | null> {
  const patch: Record<string, string> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.jdText !== undefined) patch.jd_text = updates.jdText;

  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as JobRow | null;
}

export async function deleteJob(id: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return (data?.length ?? 0) > 0;
}
