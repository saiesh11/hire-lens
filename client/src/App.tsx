import { useState } from "react";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";
import { Jobs } from "./pages/Jobs";
import { JobDetail } from "./pages/JobDetail";
import { CandidateDetail } from "./pages/CandidateDetail";

type View =
  | { name: "jobs" }
  | { name: "job-detail"; jobId: string }
  | { name: "candidate-detail"; candidateId: string; jobId: string };

function LensMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-600" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="10.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function NavBar({ onHome }: { onHome: () => void }) {
  return (
    <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <button onClick={onHome} className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <LensMark />
          HireLens
        </button>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </nav>
  );
}

function AppContent() {
  const [view, setView] = useState<View>({ name: "jobs" });
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar onHome={() => setView({ name: "jobs" })} />

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
    </div>
  );
}

function App() {
  return (
    <>
      <SignedIn>
        <AppContent />
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-50 px-4">
          <div className="flex items-center gap-2 text-xl font-semibold text-gray-900">
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
