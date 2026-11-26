"use client";

import React, { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { DropzoneEmpty } from "@/components/analyzer/DropzoneEmpty";
import { ProcessingStage } from "@/components/analyzer/ProcessingStage";
import { ResultView } from "@/components/analyzer/ResultView";
import { generateMockResult } from "@/lib/api/mockAdapter";
import { AlertCircle, RotateCcw } from "lucide-react";

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const status = useAnalyzerStore((s) => s.status);
  const error = useAnalyzerStore((s) => s.error);
  const reset = useAnalyzerStore((s) => s.reset);
  const setResult = useAnalyzerStore((s) => s.setResult);

  useEffect(() => {
    const sample = searchParams.get("sample");
    if (sample && status === "idle") {
      const mock = generateMockResult(
        sample === "bonafide"
          ? "authenticated_human_speech_studio.wav"
          : "synthetic_voice_conversion_clone.mp3"
      );
      setResult(mock);
    }
  }, [searchParams, status, setResult]);

  return (
    <>
      {/* State A: Idle (Dropzone) */}
      {status === "idle" && <DropzoneEmpty />}

      {/* State B: Processing Stage */}
      {status === "processing" && <ProcessingStage />}

      {/* State C: Result View */}
      {status === "done" && <ResultView />}

      {/* Error State */}
      {status === "error" && (
        <div className="w-full max-w-xl mx-auto py-16 flex flex-col items-center text-center gap-6 select-none">
          <div className="w-16 h-16 rounded-full bg-spoof/10 border border-spoof/30 flex items-center justify-center text-spoof">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-display font-black text-3xl uppercase tracking-tight text-white">
              Classification Error
            </h2>
            <p className="font-mono text-xs text-muted max-w-md">
              {error || "An unexpected error occurred during audio processing."}
            </p>
          </div>

          <button
            onClick={reset}
            className="px-6 py-3 rounded-full bg-white text-ink font-mono text-xs font-bold uppercase tracking-wider hover:bg-bonafide transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </>
  );
}

export default function AnalyzePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="font-mono text-xs text-muted p-8">Loading Forensic Station...</div>}>
        <AnalyzeContent />
      </Suspense>
    </AppShell>
  );
}
