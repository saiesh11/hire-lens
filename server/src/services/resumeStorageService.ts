import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const BUCKET = "resumes";

export class ResumeStorageError extends Error {}

export async function uploadResumeFile(userId: string, buffer: Buffer): Promise<string> {
  const path = `${userId}/${randomUUID()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf" });

  if (error) {
    throw new ResumeStorageError(error.message);
  }

  return path;
}

export async function downloadResumeFile(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);

  if (error || !data) {
    throw new ResumeStorageError(error?.message ?? "Failed to download resume file");
  }

  return Buffer.from(await data.arrayBuffer());
}

// Best-effort cleanup — never throws, since a storage cleanup failure should
// never block a DB delete that already succeeded.
export async function deleteResumeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
    if (error) {
      console.error("Failed to delete resume file(s) from storage (non-fatal):", error);
    }
  } catch (err) {
    console.error("Unexpected error deleting resume file(s) from storage (non-fatal):", err);
  }
}
