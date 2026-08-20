import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignIn, UserButton, OrganizationSwitcher, OrganizationList, useAuth } from "@clerk/clerk-react";
import { Sun, Moon, Settings as SettingsIcon } from "lucide-react";
import { Jobs } from "./pages/Jobs";
import { JobDetail } from "./pages/JobDetail";
import { CandidateDetail } from "./pages/CandidateDetail";
import { Settings } from "./pages/Settings";
import { getPreferredTheme, setStoredTheme } from "./lib/preferences";
import type { Theme } from "./lib/types";

type View =
  | { name: "jobs" }
  | { name: "job-detail"; jobId: string }
  | { name: "candidate-detail"; candidateId: string; jobId: string }
  | { name: "settings" };

function LensMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="10.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function NavBar({
  onHome,
  onSettings,
  theme,
  onToggleTheme,
}: {
  onHome: () => void;
  onSettings: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <button onClick={onHome} className="flex items-center gap-2 text-base font-semibold text-foreground">
          <LensMark />
          HireLens
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={onSettings}
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          <SignedIn>
            <div className="ml-1 flex items-center gap-1">
              <OrganizationSwitcher hidePersonal />
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const { orgId } = useAuth();
  const [view, setView] = useState<View>({ name: "jobs" });
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);
  const [theme, setTheme] = useState<Theme>(getPreferredTheme);

  // Jobs/candidates are org-scoped, so switching the active org via
  // <OrganizationSwitcher /> can leave the current view pointing at data
  // that no longer belongs to it (or a stale, unrefreshed Jobs list — its
  // own fetch effect only re-runs on jobsRefreshKey, not on org changes).
  // Snap back to the Jobs list and force a fresh fetch scoped to whichever
  // org is now active, rather than risk showing another org's data or a 404.
  useEffect(() => {
    setView({ name: "jobs" });
    setJobsRefreshKey((k) => k + 1);
  }, [orgId]);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        onHome={() => setView({ name: "jobs" })}
        onSettings={() => setView({ name: "settings" })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

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

function RequireOrganization() {
  const { orgId } = useAuth();

  // Membership is required org-wide (set in the Clerk Dashboard), so this is
  // a defensive fallback rather than the primary gate — Clerk's own session
  // flow should usually get a user to an active org before this renders, but
  // don't assume that fully covers every case.
  if (!orgId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
        <div className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <LensMark />
          HireLens
        </div>
        <p className="text-sm text-muted-foreground">Create or join an organization to continue.</p>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/" afterSelectOrganizationUrl="/" />
      </div>
    );
  }

  return <AppContent />;
}

function App() {
  return (
    <>
      <SignedIn>
        <RequireOrganization />
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
          <div className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <LensMark />
            HireLens
          </div>
          <SignIn />
        </div>
      </SignedOut>
    </>
  );
}

export default App;
