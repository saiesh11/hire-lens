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
  // Not read directly — clerkMiddleware() picks these up from process.env
  // itself. Validated here anyway so a missing key fails loudly at startup
  // instead of as a cryptic 401 on the first request.
  clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
  clerkPublishableKey: requireEnv("CLERK_PUBLISHABLE_KEY"),
};
