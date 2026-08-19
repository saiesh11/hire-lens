import { useState } from "react";
import { Home } from "./pages/Home";
import { History } from "./pages/History";
import { ResultDetail } from "./pages/ResultDetail";
import type { AnalysisDetail } from "./lib/types";

type View = { name: "home" } | { name: "history" } | { name: "detail"; id: string };

function NavBar({
  active,
  onNavigate,
}: {
  active: View["name"];
  onNavigate: (name: "home" | "history") => void;
}) {
  const linkClasses = (name: "home" | "history") =>
    `px-3 py-2 text-sm font-medium rounded-md ${
      active === name
        ? "bg-indigo-100 text-indigo-700"
        : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
        <button onClick={() => onNavigate("home")} className={linkClasses("home")}>
          Home
        </button>
        <button onClick={() => onNavigate("history")} className={linkClasses("history")}>
          History
        </button>
      </div>
    </nav>
  );
}

function App() {
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

export default App;
