import { useEffect, useRef, useState } from "react";
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
import { pathForView, viewFromPath, type View } from "./lib/router";
import { clearCache } from "./lib/pageCache";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY — set it in client/.env");
}

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
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname));
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  // Pushes a real browser history entry for forward/lateral navigation, so
  // the browser's native back/forward — and the trackpad's two-finger
  // swipe-back gesture, which is just a shortcut for history.back() —
  // actually have something to navigate through. Each pushed entry carries
  // an incrementing `depth` in its state object (the entry from the initial
  // page load has state === null, i.e. depth 0).
  function navigate(next: View) {
    const nextDepth = ((window.history.state as { depth?: number } | null)?.depth ?? 0) + 1;
    setView(next);
    window.history.pushState({ depth: nextDepth }, "", pathForView(next));
  }

  // For "Back" actions: prefer real history.back() over pushing a new entry,
  // so clicking Back repeatedly shrinks the stack instead of growing it —
  // pushing on every back click was making swipe-back need far more swipes
  // than expected to actually leave a page. Only falls back to navigate()
  // (push) when the current entry's depth is 0, meaning this page was
  // reached via a direct/deep link with no local history to pop — calling
  // history.back() there would navigate away from the app entirely.
  function goBack(parent: View) {
    const depth = (window.history.state as { depth?: number } | null)?.depth ?? 0;
    if (depth > 0) {
      window.history.back();
    } else {
      navigate(parent);
    }
  }

  useEffect(() => {
    function onPopState() {
      setView(viewFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Jobs/candidates are org-scoped, so switching the active org via
  // <OrganizationSwitcher /> can leave the current view pointing at data
  // that no longer belongs to it (or a stale, unrefreshed Jobs list — its
  // own fetch effect only re-runs on jobsRefreshKey, not on org changes).
  // Snap back to the Dashboard and force a fresh fetch scoped to whichever
  // org is now active, rather than risk showing another org's data or a 404.
  // Only fires when we can prove this is a real switch — a previously-known
  // real org id changing to a different real org id — not just comparing
  // against the first render: Clerk can emit more than one orgId change
  // while resolving a session on a fresh page load (e.g. a cached value
  // then a confirmed one), and each of those would otherwise wipe a
  // URL-derived deep link back to the Dashboard before the user ever saw it.
  const prevOrgId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const previous = prevOrgId.current;
    prevOrgId.current = orgId;
    if (previous && orgId && previous !== orgId) {
      // Every cached page belongs to whichever org was active when it was
      // fetched — clearing on a real org switch isn't a UX nicety, it's what
      // stops another org's cached data from being briefly visible.
      clearCache();
      setView({ name: "dashboard" });
      window.history.replaceState(null, "", "/");
      setJobsRefreshKey((k) => k + 1);
    }
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
        onHome={() => navigate({ name: "dashboard" })}
        onJobs={() => navigate({ name: "jobs" })}
        onSettings={() => navigate({ name: "settings" })}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {view.name === "dashboard" && (
        <Dashboard refreshKey={jobsRefreshKey} onCreateJob={() => navigate({ name: "jobs" })} />
      )}

      {view.name === "jobs" && (
        <Jobs
          refreshKey={jobsRefreshKey}
          onSelect={(jobId) => navigate({ name: "job-detail", jobId })}
          onCreated={() => setJobsRefreshKey((k) => k + 1)}
        />
      )}

      {view.name === "job-detail" && (
        <JobDetail
          jobId={view.jobId}
          onBack={() => goBack({ name: "jobs" })}
          onSelectCandidate={(candidateId) =>
            navigate({ name: "candidate-detail", candidateId, jobId: view.jobId })
          }
          onJobDeleted={() => {
            setJobsRefreshKey((k) => k + 1);
            goBack({ name: "jobs" });
          }}
        />
      )}

      {view.name === "candidate-detail" && (
        <CandidateDetail
          candidateId={view.candidateId}
          onBack={() => goBack({ name: "job-detail", jobId: view.jobId })}
        />
      )}

      {view.name === "settings" && <Settings onBack={() => goBack({ name: "jobs" })} />}
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
