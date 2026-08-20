// One-time Phase 5 migration: bootstrap one Clerk organization per existing
// user and point their jobs/candidates at it. Idempotent — only touches rows
// where org_id is still null, so safe to re-run if it fails partway.
//
// Run from server/: npx tsx scripts/backfillOrganizations.ts
//
// Every candidate's user_id already matches its parent job's user_id by
// construction (candidateService.createCandidate is only ever called after
// getJobById(jobId, userId) succeeds, which requires that same userId to
// already own the job) — so distinct user_ids in `jobs` is the complete set
// of users needing an org.

import { clerkClient } from "@clerk/express";
import { supabase } from "../src/lib/supabase.js";

async function main() {
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("user_id")
    .is("org_id", null);

  if (error) {
    throw new Error(`Failed to load jobs needing an org: ${error.message}`);
  }

  const userIds = [...new Set((jobs ?? []).map((row) => row.user_id))];
  if (userIds.length === 0) {
    console.log("No jobs with a null org_id — nothing to backfill.");
    return;
  }

  console.log(`Backfilling organizations for ${userIds.length} user(s)...`);

  for (const userId of userIds) {
    const user = await clerkClient.users.getUser(userId);
    const orgName =
      user.firstName ??
      user.emailAddresses[0]?.emailAddress.split("@")[0] ??
      `User ${userId}`;

    const org = await clerkClient.organizations.createOrganization({
      name: `${orgName}'s Team`,
      createdBy: userId, // createdBy alone makes this user an org:admin member
    });

    console.log(`  ${userId} -> org ${org.id} ("${org.name}")`);

    const [jobsUpdate, candidatesUpdate] = await Promise.all([
      supabase.from("jobs").update({ org_id: org.id }).eq("user_id", userId).is("org_id", null),
      supabase.from("candidates").update({ org_id: org.id }).eq("user_id", userId).is("org_id", null),
    ]);

    if (jobsUpdate.error) {
      throw new Error(`Failed to backfill jobs.org_id for ${userId}: ${jobsUpdate.error.message}`);
    }
    if (candidatesUpdate.error) {
      throw new Error(`Failed to backfill candidates.org_id for ${userId}: ${candidatesUpdate.error.message}`);
    }
  }

  console.log("Done. Re-run server/supabase/schema.sql to enforce org_id NOT NULL.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
