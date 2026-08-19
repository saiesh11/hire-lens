import { useState } from "react";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Home } from "./pages/Home";
import { History } from "./pages/History";
import { ResultDetail } from "./pages/ResultDetail";
import type { AnalysisDetail } from "./lib/types";

type View = { name: "home" } | { name: "history" } | { name: "detail"; id: string };

function LensMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-600" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="10.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function NavBar({
  active,
  onNavigate,
}: {
  active: View["name"];
  onNavigate: (name: "home" | "history") => void;
}) {
  const linkClasses = (name: "home" | "history") =>
    `h-auto rounded-md px-3 py-1.5 text-sm font-medium ${
      active === name
        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2 text-base font-semibold text-gray-900"
        >
          <LensMark />
          HireLens
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={() => onNavigate("home")} className={linkClasses("home")}>
              Home
            </Button>
            <Button variant="ghost" onClick={() => onNavigate("history")} className={linkClasses("history")}>
              History
            </Button>
          </div>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const [view, setView] = useState<View>({ name: "home" });
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  function handleAnalyzed(_analysis: AnalysisDetail) {
    setHistoryRefreshKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        active={view.name}
        onNavigate={(name) =>
          setView(name === "home" ? { name: "home" } : { name: "history" })
        }
      />

      {view.name === "home" && <Home onAnalyzed={handleAnalyzed} />}

      {view.name === "history" && (
        <History
          refreshKey={historyRefreshKey}
          onSelect={(id) => setView({ name: "detail", id })}
        />
      )}

      {view.name === "detail" && (
        <ResultDetail id={view.id} onBack={() => setView({ name: "history" })} />
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
