import { useEffect, useState } from "react";

const STAGES = [
  "Reading your resume...",
  "Comparing against the job description...",
  "Scoring each requirement...",
  "Building your scorecard...",
];

function FileIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 text-indigo-600" fill="none">
      <path
        d="M11 4h17l9 9v29a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M28 4v9h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="14" y1="22" x2="34" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="28" x2="34" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="34" x2="25" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MagnifyingGlassIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 text-amber-500 drop-shadow-sm" fill="none">
      <circle cx="20" cy="20" r="13" fill="white" stroke="currentColor" strokeWidth="3.5" />
      <line
        x1="29.5"
        y1="29.5"
        x2="41"
        y2="41"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AnalyzingAnimation() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative flex h-32 w-full items-center justify-center">
        <div
          className="absolute h-24 w-24 rounded-full bg-indigo-200/60 blur-xl"
          style={{ animation: "hl-glow-pulse 2.4s ease-in-out infinite" }}
        />
        <div
          className="absolute"
          style={{ animation: "hl-slide-in-file 0.7s ease-out forwards, hl-file-bob 2.6s ease-in-out 0.7s infinite" }}
        >
          <FileIcon />
        </div>
        <div
          className="absolute"
          style={{
            animation:
              "hl-slide-in-glass 0.7s ease-out 0.12s both, hl-scan-loop 2.8s ease-in-out 0.82s infinite",
          }}
        >
          <MagnifyingGlassIcon />
        </div>
      </div>
      <p
        key={stageIndex}
        className="text-sm font-medium text-gray-600"
        style={{ animation: "hl-fade-up 0.3s ease-out" }}
      >
        {STAGES[stageIndex]}
      </p>
    </div>
  );
}
