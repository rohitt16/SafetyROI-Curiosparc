import React from 'react';

const tierStyles = {
  LOW: {
    border: 'border-emerald-500/30',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.12)]',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    text: 'text-emerald-400'
  },
  MODERATE: {
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    text: 'text-amber-400'
  },
  HIGH: {
    border: 'border-orange-500/40',
    glow: 'shadow-[0_0_35px_rgba(249,115,22,0.2)]',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    text: 'text-orange-400'
  },
  CRITICAL: {
    border: 'border-red-500/50',
    glow: 'shadow-[0_0_40px_rgba(239,68,68,0.35)] animate-pulse',
    badge: 'bg-red-500/20 text-red-400 border-red-500/50 animate-bounce',
    text: 'text-red-400'
  }
};

export function RiskScoreCard({ score, tier, delayMins }) {
  const currentStyle = tierStyles[tier] || tierStyles.MODERATE;

  return (
    <div className={`relative bg-slate-900/90 backdrop-blur-md border ${currentStyle.border} ${currentStyle.glow} rounded-2xl p-6 transition-all duration-500`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
          Telemetry Risk Index
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentStyle.badge}`}>
          {tier}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-5xl font-extrabold tracking-tight ${currentStyle.text}`}>
          {score}
        </span>
        <span className="text-sm font-medium text-slate-400">/ 100</span>
      </div>

      {delayMins > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-300">Recommended Shift:</span>
          <span className="font-mono font-semibold text-amber-400">
            +{delayMins} mins departure offset
          </span>
        </div>
      )}
    </div>
  );
}