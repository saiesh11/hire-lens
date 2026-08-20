import { Router } from "express";
import { getAuth } from "@clerk/express";
import { createJobSchema, updateJobSchema } from "../schemas.js";
import {
  createJob,
  deleteJob,
  getJobById,
  listJobs,
  updateJob,
  SupabaseServiceError,
} from "../services/jobService.js";
import { listCandidatesForJob, listCandidateStoragePathsForJob } from "../services/candidateService.js";
import { deleteResumeFiles } from "../services/resumeStorageService.js";

export const jobsRouter = Router();

jobsRouter.post("/jobs", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to create a job" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const job = await createJob({ userId, orgId, title: parsed.data.title, jdText: parsed.data.jdText });
    return res.status(201).json(job);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to create job:", error);
      return res.status(500).json({ error: "Failed to create job" });
    }
    console.error("Unexpected error in POST /api/jobs:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

jobsRouter.get("/jobs", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to view your jobs" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  try {
    const jobs = await listJobs(orgId);
    return res.json(jobs);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to load jobs:", error);
      return res.status(500).json({ error: "Failed to load jobs" });
    }
    console.error("Unexpected error in GET /api/jobs:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

jobsRouter.get("/jobs/:id", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to view this job" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  try {
    const job = await getJobById(req.params.id, orgId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    const candidates = await listCandidatesForJob(job.id, orgId);
    return res.json({ ...job, candidates });
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to load job:", error);
      return res.status(500).json({ error: "Failed to load job" });
    }
    console.error("Unexpected error in GET /api/jobs/:id:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

jobsRouter.patch("/jobs/:id", async (req, res) => {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to edit this job" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }

  const parsed = updateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const job = await updateJob(req.params.id, orgId, parsed.data);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.json(job);
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to update job:", error);
      return res.status(500).json({ error: "Failed to update job" });
    }
    console.error("Unexpected error in PATCH /api/jobs/:id:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

jobsRouter.delete("/jobs/:id", async (req, res) => {
  const auth = getAuth(req);
  const { userId, orgId } = auth;
  if (!userId) {
    return res.status(401).json({ error: "Sign in to delete this job" });
  }
  if (!orgId) {
    return res.status(403).json({ error: "Join or create an organization to continue" });
  }
  if (!auth.has({ role: "org:admin" })) {
    return res.status(403).json({ error: "Only organization admins can delete this" });
  }

  try {
    // Fetched before deleting — on delete cascade removes the candidate rows
    // in Postgres, so they'd be gone before a post-delete select could see them.
    const storagePaths = await listCandidateStoragePathsForJob(req.params.id, orgId);
    const deleted = await deleteJob(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ error: "Job not found" });
    }
    await deleteResumeFiles(storagePaths);
    return res.status(204).send();
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      console.error("Failed to delete job:", error);
      return res.status(500).json({ error: "Failed to delete job" });
    }
    console.error("Unexpected error in DELETE /api/jobs/:id:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});
