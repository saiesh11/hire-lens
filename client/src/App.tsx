import { useEffect, useState } from "react";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  OrganizationSwitcher,
  OrganizationList,
  useAuth,
} from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { Sun, Moon, Settings as SettingsIcon, Briefcase } from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import { JobDetail } from "./pages/JobDetail";
import { CandidateDetail } from "./pages/CandidateDetail";
import { Settings } from "./pages/Settings";
import { getPreferredTheme, setStoredTheme } from "./lib/preferences";
import type { Theme } from "./lib/types";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY — set it in client/.env");
}

type View =
  | { name: "dashboard" }
  | { name: "jobs" }
  | { name: "job-detail"; jobId: string }
  | { name: "candidate-detail"; candidateId: string; jobId: string }
  | { name: "settings" };

function LensMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-indigo-600 dark:text-indigo-400" fill="none">
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        stroke="currentColor"
        strokeWidth="2"
        className="transition-transform duration-300 group-hover:scale-110"
        style={{ transformOrigin: "10.5px 10.5px" }}
      />
      <circle
        cx="10.5"
        cy="10.5"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
        className="transition-transform duration-300 group-hover:scale-125"
        style={{ transformOrigin: "10.5px 10.5px" }}
      />
      <line
        x1="15.5"
        y1="15.5"
        x2="21"
        y2="21"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5"
      />
    </svg>
  );
}

function NavBar({
  active,
  onHome,
  onJobs,
  onSettings,
  theme,
  onToggleTheme,
}: {
  active: "dashboard" | "jobs" | null;
  onHome: () => void;
  onJobs: () => void;
  onSettings: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <nav className="sticky top-0 z-10 overflow-hidden border-b border-border bg-background/80 backdrop-blur">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.3]"
        style={{
          backgroundImage: "linear-gradient(115deg, #6366f1, #a78bfa, #60a5fa, #818cf8, #6366f1)",
          backgroundSize: "300% 100%",
          animation: "hl-aurora-drift 20s ease-in-out infinite",
        }}
      />
      <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onHome}
            className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 text-lg font-semibold font-display text-foreground transition-colors ${
              active === "dashboard" ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-muted"
            }`}
          >
            <LensMark />
            HireLens
          </button>
          <button
            onClick={onJobs}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-base font-medium transition-colors ${
              active === "jobs"
                ? "bg-indigo-50 text-foreground dark:bg-indigo-950/40"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Jobs
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Sun
              className={`absolute h-5 w-5 transition-all duration-300 ${
                theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
              }`}
            />
            <Moon
              className={`absolute h-5 w-5 transition-all duration-300 ${
                theme === "dark" ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
          </button>
          <button
            onClick={onSettings}
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-transform duration-300 hover:rotate-45 hover:bg-muted hover:text-foreground"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
          <SignedIn>
            <div className="ml-2 flex items-center gap-2">
              <OrganizationSwitcher hidePersonal />
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}

function AppContent({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { orgId } = useAuth();
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  // Jobs/candidates are org-scoped, so switching the active org via
  // <OrganizationSwitcher /> can leave the current view pointing at data
  // that no longer belongs to it (or a stale, unrefreshed Jobs list — its
  // own fetch effect only re-runs on jobsRefreshKey, not on org changes).
  // Snap back to the Dashboard and force a fresh fetch scoped to whichever
  // org is now active, rather than risk showing another org's data or a 404.
  useEffect(() => {
    setView({ name: "dashboard" });
    setJobsRefreshKey((k) => k + 1);
  }, [orgId]);

  const active: "dashboard" | "jobs" | null =
    view.name === "dashboard"
      ? "dashboard"
      : view.name === "jobs" || view.name === "job-detail" || view.name === "candidate-detail"
        ? "jobs"
        : null;

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        active={active}
        onHome={() => setView({ name: "dashboard" })}
        onJobs={() => setView({ name: "jobs" })}
        onSettings={() => setView({ name: "settings" })}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {view.name === "dashboard" && (
        <Dashboard refreshKey={jobsRefreshKey} onCreateJob={() => setView({ name: "jobs" })} />
      )}

      {view.name === "jobs" && (
        <Jobs
          refreshKey={jobsRefreshKey}
          onSelect={(jobId) => setView({ name: "job-detail", jobId })}
          onCreated={() => setJobsRefreshKey((k) => k + 1)}
        />
      )}

      {view.name === "job-detail" && (
        <JobDetail
          jobId={view.jobId}
          onBack={() => setView({ name: "jobs" })}
          onSelectCandidate={(candidateId) =>
            setView({ name: "candidate-detail", candidateId, jobId: view.jobId })
          }
          onJobDeleted={() => {
            setJobsRefreshKey((k) => k + 1);
            setView({ name: "jobs" });
          }}
        />
      )}

      {view.name === "candidate-detail" && (
        <CandidateDetail
          candidateId={view.candidateId}
          onBack={() => setView({ name: "job-detail", jobId: view.jobId })}
        />
      )}

      {view.name === "settings" && <Settings onBack={() => setView({ name: "jobs" })} />}
    </div>
  );
}

function RequireOrganization({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { orgId } = useAuth();

  // Membership is required org-wide (set in the Clerk Dashboard), so this is
  // a defensive fallback rather than the primary gate — Clerk's own session
  // flow should usually get a user to an active org before this renders, but
  // don't assume that fully covers every case.
  if (!orgId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
        <div className="flex items-center gap-2 text-xl font-semibold font-display text-foreground">
          <LensMark />
          HireLens
        </div>
        <p className="text-sm text-muted-foreground">Create or join an organization to continue.</p>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/" afterSelectOrganizationUrl="/" />
      </div>
    );
  }

  return <AppContent theme={theme} onToggleTheme={onToggleTheme} />;
}

function App() {
  const [theme, setTheme] = useState<Theme>(getPreferredTheme);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} appearance={{ theme: theme === "dark" ? dark : undefined }}>
      <SignedIn>
        <RequireOrganization theme={theme} onToggleTheme={toggleTheme} />
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
          <div className="flex items-center gap-2 text-xl font-semibold font-display text-foreground">
            <LensMark />
            HireLens
          </div>
          <SignIn />
        </div>
      </SignedOut>
    </ClerkProvider>
  );
}

export default App;
