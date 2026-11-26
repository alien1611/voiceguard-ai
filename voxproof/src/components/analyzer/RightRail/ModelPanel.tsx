"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { Cpu, ShieldCheck } from "lucide-react";

export const ModelPanel: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);

  if (!result) return null;

  return (
    <div className="p-5 rounded-2xl bg-ink-2 border border-line flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <span className="font-bold uppercase tracking-wider text-white">
          Active Checkpoint
        </span>
        <Cpu className="w-4 h-4 text-muted" />
      </div>

      <div className="flex justify-between text-muted">
        <span>Model ID:</span>
        <span className="text-white font-bold">{result.model.name}</span>
      </div>

      <div className="flex justify-between text-muted">
        <span>Checkpoint Version:</span>
        <span className="text-white">{result.model.version}</span>
      </div>

      <div className="flex justify-between text-muted">
        <span>Nominal Threshold:</span>
        <span className="text-white">{result.model.threshold.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-muted">
        <span>Parameters:</span>
        <span className="text-white">
          {result.model.parameters_count?.toLocaleString() || "24,305"}
        </span>
      </div>
    </div>
  );
};
