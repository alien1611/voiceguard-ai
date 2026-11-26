"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";

export const VerdictMeter: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const clientThreshold = useAnalyzerStore((s) => s.clientThreshold);
  const { verdict, score, confidence } = useAnalyzerStore((s) =>
    s.getCalibratedVerdict()
  );

  const uncertainBand = result?.model.uncertain_band || [0.42, 0.58];

  const scorePct = Math.min(100, Math.max(0, score * 100));
  const threshPct = clientThreshold * 100;
  const bandStartPct = uncertainBand[0] * 100;
  const bandWidthPct = (uncertainBand[1] - uncertainBand[0]) * 100;

  const isSpoof = verdict === "spoof";
  const isBonafide = verdict === "bonafide";

  return (
    <div className="w-full p-6 rounded-2xl bg-ink-2 border border-line flex flex-col gap-4 select-none">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          Forensic Likelihood Gauge
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            Score: <strong className="text-white">{score.toFixed(2)}</strong>
          </span>
          <span
            className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
              isSpoof
                ? "bg-spoof/20 text-spoof border border-spoof/30"
                : isBonafide
                ? "bg-bonafide/20 text-bonafide border border-bonafide/30"
                : "bg-uncertain/20 text-uncertain border border-uncertain/30"
            }`}
          >
            {verdict} ({confidence}%)
          </span>
        </div>
      </div>

      {/* Horizontal Meter Bar */}
      <div className="relative w-full h-4 rounded-full bg-ink border border-line overflow-hidden">
        {/* Continuous Gradient Base */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(to right, #C6FF3D 0%, #FFB020 50%, #FF3D2E 100%)",
          }}
        />

        {/* Visible Uncertain Band */}
        <div
          className="absolute top-0 bottom-0 bg-uncertain/30 border-x border-uncertain/50"
          style={{
            left: `${bandStartPct}%`,
            width: `${bandWidthPct}%`,
          }}
          title="Uncertain Ambiguity Band"
        />

        {/* Threshold Tick Mark */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-sm"
          style={{ left: `${threshPct}%` }}
          title={`Decision Threshold: ${clientThreshold.toFixed(2)}`}
        />

        {/* Clip Score Indicator Needle */}
        <div
          className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full z-20 -ml-1 border border-ink shadow-lg transition-all duration-300"
          style={{ left: `${scorePct}%` }}
        />
      </div>

      {/* Legend & Markers */}
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted pt-1">
        <div className="flex items-center gap-1.5 text-bonafide">
          <span className="w-2 h-2 rounded-full bg-bonafide" />
          <span>Bonafide (0.00)</span>
        </div>
        <div className="flex items-center gap-1.5 text-uncertain">
          <span className="w-2 h-2 rounded-full bg-uncertain" />
          <span>
            Uncertain Band ({uncertainBand[0].toFixed(2)} -{" "}
            {uncertainBand[1].toFixed(2)})
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-spoof">
          <span className="w-2 h-2 rounded-full bg-spoof" />
          <span>Spoof (1.00)</span>
        </div>
      </div>
    </div>
  );
};
