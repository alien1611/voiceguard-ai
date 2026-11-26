"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { AnalysisResult } from "@/lib/api/types";
import { Barcode } from "../common/Barcode";
import { UploadCloud, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";

export const InlineDemo: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const runSample = async (sampleName: string) => {
    setIsProcessing(true);
    setResult(null);

    const mockFile = new File(["sample_pcm_bytes"], sampleName, {
      type: "audio/wav",
    });

    try {
      const res = await api.analyzeFile(mockFile, (s) => setStage(s));
      setResult(res);
    } finally {
      setIsProcessing(false);
    }
  };

  const isSpoof = result?.verdict === "spoof";
  const isBonafide = result?.verdict === "bonafide";

  return (
    <section className="w-full bg-ink py-28 border-b border-line">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-bonafide">
              // 04. INSTANT EVALUATION
            </span>
            <h2 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter leading-[0.9]">
              TEST THE <br />
              <span className="font-accent italic text-bonafide font-normal lowercase tracking-normal">
                pipeline
              </span>{" "}
              IN PLACE.
            </h2>
            <p className="text-muted text-sm leading-relaxed max-w-md">
              Run local audio through our 60-band Linear Frequency Cepstral
              Coefficient extractor. Experience instant zero-cloud inference
              directly within your browser session.
            </p>

            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={() => runSample("sample_human_bonafide_recording.wav")}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-full bg-ink-2 hover:bg-ink-3 border border-line hover:border-bonafide text-xs font-mono uppercase tracking-wider text-white transition-all disabled:opacity-50"
              >
                Sample 01: Genuine Human (Bonafide)
              </button>
              <button
                onClick={() => runSample("sample_elevenlabs_ai_clone.wav")}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-full bg-ink-2 hover:bg-ink-3 border border-line hover:border-spoof text-xs font-mono uppercase tracking-wider text-white transition-all disabled:opacity-50"
              >
                Sample 02: Neural Clone (Spoof)
              </button>
            </div>
          </div>

          {/* Right Compact Analyzer Card */}
          <div className="lg:col-span-7">
            <div className="w-full rounded-card bg-ink-2 border border-line p-6 sm:p-8 relative overflow-hidden shadow-2xl">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-6 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-bonafide animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-widest text-white">
                    Compact Analyzer Core
                  </span>
                </div>
                <Barcode value="VX-INLINE-DEMO" height={18} showText={false} />
              </div>

              {/* Processing State */}
              {isProcessing && (
                <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
                  <RefreshCw className="w-8 h-8 text-bonafide animate-spin" />
                  <span className="font-mono text-xs uppercase tracking-widest text-bonafide">
                    {stage || "Extracting LFCC Features..."}
                  </span>
                  <div className="w-48 h-1 rounded-full bg-ink overflow-hidden mt-2">
                    <div className="w-full h-full bg-bonafide animate-pulse" />
                  </div>
                </div>
              )}

              {/* Result State */}
              {!isProcessing && result && (
                <div className="py-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-muted tracking-widest block">
                        Target File
                      </span>
                      <span className="font-mono text-xs font-bold text-white truncate max-w-xs block">
                        {result.filename}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-muted">
                      Latency: {result.timings_ms.total}ms
                    </span>
                  </div>

                  {/* Verdict Banner */}
                  <div
                    className={`p-5 rounded-2xl border flex items-center justify-between ${
                      isSpoof
                        ? "bg-spoof/10 border-spoof/30 text-spoof"
                        : "bg-bonafide/10 border-bonafide/30 text-bonafide"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSpoof ? (
                        <AlertTriangle className="w-6 h-6" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6" />
                      )}
                      <div>
                        <span className="font-display font-black text-2xl uppercase tracking-tight block">
                          {result.verdict}
                        </span>
                        <span className="font-mono text-xs opacity-80">
                          {isSpoof
                            ? "Synthetic / Cloned Artifacts Detected"
                            : "Genuine Human Speech Resonance"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-2xl font-bold">
                        {result.confidence}%
                      </span>
                      <span className="font-mono text-[10px] block opacity-80 uppercase tracking-widest">
                        Confidence
                      </span>
                    </div>
                  </div>

                  {/* CTA into full analysis */}
                  <div className="flex items-center justify-between pt-4 border-t border-line">
                    <span className="font-mono text-[11px] text-muted">
                      Full waveform & Grad-CAM inspection available in console.
                    </span>
                    <Link
                      href="/analyze"
                      className="inline-flex items-center gap-2 font-mono text-xs uppercase font-bold text-bonafide hover:underline"
                    >
                      <span>Open in Studio</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Idle State (Dropzone) */}
              {!isProcessing && !result && (
                <div className="py-14 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-ink-3 border border-line flex items-center justify-center text-muted">
                    <UploadCloud className="w-7 h-7 text-bonafide" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Select A Sample Above Or Drop A File
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      Accepts 16 kHz WAV, MP3, FLAC (Max 25 MB)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
