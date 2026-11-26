"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { Activity, Clock, ShieldAlert, Cpu } from "lucide-react";

export const SummaryPanel: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const { verdict, score, confidence } = useAnalyzerStore((s) =>
    s.getCalibratedVerdict()
  );

  if (!result) return null;

  const maxSegmentScore = Math.max(...result.segments.map((s) => s.score));
  const flaggedWindows = result.segments.filter((s) => s.verdict === "spoof").length;
  const flaggedPct = Math.round((flaggedWindows / result.segments.length) * 100);

  return (
    <div className="p-5 rounded-2xl bg-ink-2 border border-line flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
          Acoustic Summary
        </span>
        <Activity className="w-4 h-4 text-bonafide" />
      </div>

      <div className="grid grid-cols-2 gap-3 font-mono text-xs">
        <div className="p-2.5 rounded-xl bg-ink-3/50 border border-line flex flex-col">
          <span className="text-[10px] text-muted uppercase">Global Score</span>
          <span className="text-base font-bold text-white">{score.toFixed(3)}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-ink-3/50 border border-line flex flex-col">
          <span className="text-[10px] text-muted uppercase">Peak Window</span>
          <span className="text-base font-bold text-spoof">
            {maxSegmentScore.toFixed(3)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-ink-3/50 border border-line flex flex-col">
          <span className="text-[10px] text-muted uppercase">Windows Flagged</span>
          <span className="text-base font-bold text-white">
            {flaggedWindows} / {result.segments.length} ({flaggedPct}%)
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-ink-3/50 border border-line flex flex-col">
          <span className="text-[10px] text-muted uppercase">Total Latency</span>
          <span className="text-base font-bold text-bonafide">
            {result.timings_ms.total} ms
          </span>
        </div>
      </div>
    </div>
  );
};
