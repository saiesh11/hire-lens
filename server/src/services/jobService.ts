import { supabase } from "../lib/supabase.js";

export interface JobRow {
  id: string;
  user_id: string;
  org_id: string;
  created_at: string;
  title: string;
  jd_text: string;
  jd_updated_at: string;
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
  orgId: string;
  title: string;
  jdText: string;
}): Promise<JobRow> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({ user_id: input.userId, org_id: input.orgId, title: input.title, jd_text: input.jdText })
    .select()
    .single();

  if (error || !data) {
    throw new SupabaseServiceError(error?.message ?? "Failed to create job");
  }

  return data as JobRow;
}

export async function listJobs(orgId: string): Promise<JobListItem[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, created_at, title, candidates(count)")
    .eq("org_id", orgId)
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

export async function getJobById(id: string, orgId: string): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, user_id, org_id, created_at, title, jd_text, jd_updated_at")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as JobRow | null;
}

export async function updateJob(
  id: string,
  orgId: string,
  updates: { title?: string; jdText?: string },
): Promise<JobRow | null> {
  const patch: Record<string, string> = {};
  if (updates.title !== undefined) patch.title = updates.title;

  if (updates.jdText !== undefined) {
    // Bump jd_updated_at only if the text actually changed — the frontend's
    // edit form submits title+jdText together on every save, so "field was
    // present in the request" is not a valid proxy for "field changed."
    const { data: current, error: fetchError } = await supabase
      .from("jobs")
      .select("jd_text")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (fetchError) {
      throw new SupabaseServiceError(fetchError.message);
    }
    if (!current) {
      return null;
    }

    patch.jd_text = updates.jdText;
    if (current.jd_text !== updates.jdText) {
      patch.jd_updated_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return data as JobRow | null;
}

export async function deleteJob(id: string, orgId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");

  if (error) {
    throw new SupabaseServiceError(error.message);
  }

  return (data?.length ?? 0) > 0;
}
