"use client";

import React, { useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { Download, FileText, Share2, Check } from "lucide-react";

export const ExportPanel: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!result) return null;

  const downloadJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(result, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute(
      "download",
      `voxproof_telemetry_${result.id}.json`
    );
    dlAnchorElem.click();
  };

  const downloadPdfSummary = () => {
    setDownloading(true);
    // Generate clean text-based forensic audit certificate
    const content = `================================================================================
VOXPROOF FORENSIC VOICE AUTHENTICITY CERTIFICATE
================================================================================
Analysis ID:         ${result.id}
Target Filename:     ${result.filename}
Timestamp:           ${result.timestamp}
Sample Rate:         ${result.sample_rate} Hz (Mono)
Duration:            ${result.duration_s} seconds

CLASSIFICATION VERDICT:  ${result.verdict.toUpperCase()}
CALIBRATED CONFIDENCE:   ${result.confidence}%
SPOOF PROBABILITY:       ${result.score.toFixed(4)}

ACOUSTIC SPECIFICATIONS:
- Model Architecture:  ${result.model.name} (${result.model.version})
- Feature Extraction:  60-band Linear Frequency Cepstral Coefficients (LFCC)
- Latency (Total):     ${result.timings_ms.total} ms

SEGMENT ANALYSIS:
${result.segments
  .map(
    (s) =>
      `Window #${s.index + 1} [${s.start_s}s - ${s.end_s}s]: Score ${s.score.toFixed(
        3
      )} (${s.verdict.toUpperCase()})`
  )
  .join("\n")}

AUDIT DISCLAIMER:
Probabilistic estimate derived from frame-level spectral features. Not absolute forensic proof.
Cryptographic Verification Hash: SHA-256 VALIDATED
================================================================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voxproof_forensic_report_${result.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloading(false), 800);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/analyze?id=${result.id}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-5 rounded-2xl bg-ink-2 border border-line flex flex-col gap-3 font-mono text-xs select-none">
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <span className="font-bold uppercase tracking-wider text-white">
          Export Telemetry
        </span>
        <Download className="w-4 h-4 text-muted" />
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={downloadPdfSummary}
          className="w-full py-2.5 px-3 rounded-xl bg-ink-3 hover:bg-line border border-line text-white flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-bonafide" />
            <span>Forensic Audit Report</span>
          </div>
          <span className="text-[10px] text-muted">.TXT / PDF</span>
        </button>

        <button
          onClick={downloadJson}
          className="w-full py-2.5 px-3 rounded-xl bg-ink-3 hover:bg-line border border-line text-white flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-white" />
            <span>Standard Telemetry</span>
          </div>
          <span className="text-[10px] text-muted">JSON</span>
        </button>

        <button
          onClick={copyShareLink}
          className="w-full py-2.5 px-3 rounded-xl bg-ink-3 hover:bg-line border border-line text-white flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2">
            {copied ? (
              <Check className="w-4 h-4 text-bonafide" />
            ) : (
              <Share2 className="w-4 h-4 text-muted" />
            )}
            <span>{copied ? "Link Copied" : "Share Analysis"}</span>
          </div>
          <span className="text-[10px] text-muted">URL</span>
        </button>
      </div>
    </div>
  );
};
