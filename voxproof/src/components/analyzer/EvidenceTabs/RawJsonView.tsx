"use client";

import React, { useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { Copy, Check } from "lucide-react";

export const RawJsonView: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const [copied, setCopied] = useState(false);

  const jsonString = result
    ? JSON.stringify(
        {
          ...result,
          lfcc: {
            ...result.lfcc,
            data: "[60x120 Matrix Truncated For Display]",
          },
          waveform_peaks: "[1000 Normalized Samples Truncated]",
          saliency: result.saliency ? "[60x120 Matrix Truncated]" : undefined,
        },
        null,
        2
      )
    : "{}";

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full h-[220px] rounded-xl bg-ink border border-line p-4 relative overflow-hidden flex flex-col">
      <div className="flex items-center justify-between pb-2 border-b border-line mb-2">
        <span className="font-mono text-[10px] uppercase text-muted">
          Standardized Forensic Telemetry Schema
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ink-3 hover:bg-line text-muted hover:text-white font-mono text-[10px] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-bonafide" />
              <span>Copied Full JSON</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy Full JSON</span>
            </>
          )}
        </button>
      </div>

      <pre className="flex-1 overflow-y-auto font-mono text-[11px] text-muted/90 select-text leading-relaxed">
        {jsonString}
      </pre>
    </div>
  );
};
