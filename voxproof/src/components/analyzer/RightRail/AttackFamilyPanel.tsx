"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { ShieldAlert } from "lucide-react";

export const AttackFamilyPanel: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);

  if (!result || !result.attack_family || result.attack_family.length === 0) {
    return null;
  }

  return (
    <div className="p-5 rounded-2xl bg-ink-2 border border-line flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <span className="font-bold uppercase tracking-wider text-white">
          Predicted Synthesis Family
        </span>
        <ShieldAlert className="w-4 h-4 text-spoof" />
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        {result.attack_family.slice(0, 3).map((item, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-white truncate max-w-[180px]">
                {item.label}
              </span>
              <span className="text-spoof font-bold">
                {Math.round(item.prob * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-ink overflow-hidden border border-line">
              <div
                className="h-full bg-spoof rounded-full transition-all duration-300"
                style={{ width: `${item.prob * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
