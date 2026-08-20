import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Service-role client — bypasses RLS entirely. Use ONLY for Storage
// operations (see services/resumeStorageService.ts). Table queries
// (jobs/candidates) must keep going through the scoped anon client in
// supabase.ts — that's what preserves the user_id-scoping trust boundary
// this app relies on instead of RLS. Do not import this elsewhere.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
