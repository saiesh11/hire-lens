import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

const SIZE = 180;
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = scoreColor(clamped);

  // Animate the ring filling in from 0 on mount, and the number counting up alongside it.
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDisplayScore(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  const [animatedNumber, setAnimatedNumber] = useState(0);
  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedNumber(Math.round(eased * clamped));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const offset = CIRCUMFERENCE * (1 - displayScore / 100);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="16" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-[1100ms] ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums" style={{ color }}>
          {animatedNumber}
        </span>
        <span className="text-sm text-gray-500">Match Score</span>
      </div>
    </div>
  );
}
