"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { Sliders } from "lucide-react";

export const ThresholdSlider: React.FC = () => {
  const clientThreshold = useAnalyzerStore((s) => s.clientThreshold);
  const setClientThreshold = useAnalyzerStore((s) => s.setClientThreshold);
  const result = useAnalyzerStore((s) => s.result);

  return (
    <div className="p-5 rounded-2xl bg-ink-2 border border-line flex flex-col gap-3 font-mono text-xs select-none">
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <span className="font-bold uppercase tracking-wider text-white">
          Client Re-Threshold
        </span>
        <Sliders className="w-4 h-4 text-bonafide" />
      </div>

      <p className="text-[11px] text-muted leading-relaxed">
        Adjust decision boundary dynamically. Lower values increase spoof
        sensitivity for high-security environments.
      </p>

      <div className="flex items-center justify-between pt-2">
        <span className="text-muted">Threshold:</span>
        <span className="font-bold text-bonafide text-sm">
          {clientThreshold.toFixed(2)}
        </span>
      </div>

      <input
        type="range"
        min={0.1}
        max={0.9}
        step={0.01}
        value={clientThreshold}
        onChange={(e) => setClientThreshold(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-ink rounded-lg accent-bonafide cursor-pointer"
        aria-label="Re-threshold slider"
      />

      <div className="flex justify-between text-[10px] text-muted">
        <span>0.10 (High Sensitivity)</span>
        <button
          onClick={() => setClientThreshold(result?.model.threshold ?? 0.5)}
          className="text-bonafide hover:underline"
        >
          Reset (0.50)
        </button>
        <span>0.90 (Lenient)</span>
      </div>
    </div>
  );
};
