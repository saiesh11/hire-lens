import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseAnonKey: requireEnv("SUPABASE_ANON_KEY"),
  // Server-only — bypasses RLS entirely. Used exclusively by
  // lib/supabaseAdmin.ts for Storage operations, never for table queries.
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  // Not read directly — clerkMiddleware() picks these up from process.env
  // itself. Validated here anyway so a missing key fails loudly at startup
  // instead of as a cryptic 401 on the first request.
  clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
  clerkPublishableKey: requireEnv("CLERK_PUBLISHABLE_KEY"),
  // Optional — GitHub enrichment works unauthenticated (60 req/hr), a token
  // just raises the limit to 5,000/hr. Not required for the app to start.
  githubToken: process.env.GITHUB_TOKEN,
};
