"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { Barcode } from "../common/Barcode";
import { HeroWaveform } from "./HeroWaveform";
import { VerdictMeter } from "./VerdictMeter";
import { TransportBar } from "./TransportBar";
import { TimelineCanvas } from "./EvidenceTabs/TimelineCanvas";
import { LfccHeatmap } from "./EvidenceTabs/LfccHeatmap";
import { SpectrogramCanvas } from "./EvidenceTabs/SpectrogramCanvas";
import { SaliencyCanvas } from "./EvidenceTabs/SaliencyCanvas";
import { RawJsonView } from "./EvidenceTabs/RawJsonView";
import { SummaryPanel } from "./RightRail/SummaryPanel";
import { ModelPanel } from "./RightRail/ModelPanel";
import { AttackFamilyPanel } from "./RightRail/AttackFamilyPanel";
import { ThresholdSlider } from "./RightRail/ThresholdSlider";
import { ExportPanel } from "./RightRail/ExportPanel";
import {
  FileAudio,
  Calendar,
  Layers,
  ArrowLeft,
  Info,
} from "lucide-react";

export const ResultView: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const activeTab = useAnalyzerStore((s) => s.activeTab);
  const setActiveTab = useAnalyzerStore((s) => s.setActiveTab);
  const reset = useAnalyzerStore((s) => s.reset);

  const { verdict, score, confidence } = useAnalyzerStore((s) =>
    s.getCalibratedVerdict()
  );

  if (!result) return null;

  const isSpoof = verdict === "spoof";
  const isBonafide = verdict === "bonafide";

  // Giant vertical stacked letters (e.g. S-P-O-O-F or B-O-N-A-F-I-D-E)
  const verticalLetters = verdict.toUpperCase().split("");

  return (
    <div className="w-full max-w-[1440px] mx-auto pb-32 select-none flex flex-col gap-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={reset}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-bonafide" />
          <span>New Analysis Target</span>
        </button>

        <div className="flex items-center gap-4">
          <Barcode value={result.id} height={18} showText={false} />
          <span className="font-mono text-xs text-muted">ID: {result.id}</span>
        </div>
      </div>

      {/* Main Track Header with Vertical Giant Letters & Metadata */}
      <div className="w-full p-6 sm:p-8 rounded-card bg-ink-2 border border-line flex flex-col md:flex-row gap-8 items-start md:items-center justify-between relative overflow-hidden">
        {/* Left Edge: Giant Stacked Vertical Letters */}
        <div className="flex items-center gap-6 shrink-0">
          <div
            className={`flex flex-col items-center justify-center font-display font-black text-2xl sm:text-3xl leading-none tracking-tighter ${
              isSpoof
                ? "text-spoof"
                : isBonafide
                ? "text-bonafide"
                : "text-uncertain"
            }`}
          >
            {verticalLetters.map((char, idx) => (
              <span key={idx} className="block my-0.5">
                {char}
              </span>
            ))}
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-xs uppercase tracking-widest text-bonafide block mb-1">
              // TELEMETRY RECORD
            </span>
            <h1 className="font-display font-black text-2xl sm:text-4xl uppercase tracking-tight text-white truncate max-w-lg">
              {result.filename}
            </h1>

            {/* Tiny Meta Chips */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-3 border border-line font-mono text-[11px] text-muted">
                <FileAudio className="w-3.5 h-3.5 text-bonafide" />
                <span>{result.sample_rate} Hz (Mono)</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-3 border border-line font-mono text-[11px] text-muted">
                <span>{result.duration_s.toFixed(1)}s Duration</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-3 border border-line font-mono text-[11px] text-muted">
                <Layers className="w-3.5 h-3.5 text-white" />
                <span>60 LFCC Bands</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-3 border border-line font-mono text-[11px] text-muted">
                <Calendar className="w-3.5 h-3.5 text-muted" />
                <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Confidence Badge */}
        <div className="flex flex-col items-end shrink-0">
          <span className="font-mono text-4xl sm:text-5xl font-black text-white">
            {confidence}%
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Calibrated Confidence
          </span>
          <span
            className={`mt-1 font-mono text-xs font-bold uppercase tracking-wider ${
              isSpoof ? "text-spoof" : isBonafide ? "text-bonafide" : "text-uncertain"
            }`}
          >
            {verdict} Verdict
          </span>
        </div>
      </div>

      {/* Hero Waveform Canvas (280px tall) */}
      <HeroWaveform />

      {/* Screen reader text alternative table for waveform canvas */}
      <div className="sr-only">
        <table>
          <caption>Segment Level Forensic Audio Analysis Scores</caption>
          <thead>
            <tr>
              <th scope="col">Segment</th>
              <th scope="col">Time Range</th>
              <th scope="col">Spoof Score</th>
              <th scope="col">Classification</th>
            </tr>
          </thead>
          <tbody>
            {result.segments.map((s) => (
              <tr key={s.index}>
                <td>Window {s.index + 1}</td>
                <td>{s.start_s}s - {s.end_s}s</td>
                <td>{s.score.toFixed(3)}</td>
                <td>{s.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verdict Confidence Meter */}
      <div aria-live="polite" aria-atomic="true">
        <VerdictMeter />
      </div>

      {/* Main Studio Body: Evidence Tabs (Left 8 cols) & Right Rail (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Evidence Tabs */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Underline Tabs */}
          <div className="flex items-center gap-8 border-b border-line pb-2 font-mono text-xs uppercase tracking-wider">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`pb-2 transition-all relative ${
                activeTab === "timeline"
                  ? "text-bonafide font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              <span>01. Probability Timeline</span>
              {activeTab === "timeline" && (
                <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-bonafide" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("lfcc")}
              className={`pb-2 transition-all relative ${
                activeTab === "lfcc"
                  ? "text-bonafide font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              <span>02. LFCC Ember Heatmap</span>
              {activeTab === "lfcc" && (
                <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-bonafide" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("spectrogram")}
              className={`pb-2 transition-all relative ${
                activeTab === "spectrogram"
                  ? "text-bonafide font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              <span>03. STFT Spectrogram</span>
              {activeTab === "spectrogram" && (
                <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-bonafide" />
              )}
            </button>

            {result.saliency && (
              <button
                onClick={() => setActiveTab("saliency")}
                className={`pb-2 transition-all relative ${
                  activeTab === "saliency"
                    ? "text-bonafide font-bold"
                    : "text-muted hover:text-white"
                }`}
              >
                <span>04. Grad-CAM Saliency</span>
                {activeTab === "saliency" && (
                  <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-bonafide" />
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab("raw")}
              className={`pb-2 transition-all relative ${
                activeTab === "raw"
                  ? "text-bonafide font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              <span>05. Raw Schema</span>
              {activeTab === "raw" && (
                <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-bonafide" />
              )}
            </button>
          </div>

          {/* Active Tab View */}
          <div className="w-full">
            {activeTab === "timeline" && <TimelineCanvas />}
            {activeTab === "lfcc" && <LfccHeatmap />}
            {activeTab === "spectrogram" && <SpectrogramCanvas />}
            {activeTab === "saliency" && <SaliencyCanvas />}
            {activeTab === "raw" && <RawJsonView />}
          </div>

          {/* Always Visible Honesty Line */}
          <div className="p-4 rounded-xl bg-ink-2/80 border border-line flex items-center justify-between font-mono text-xs text-muted">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-bonafide" />
              <span className="text-white font-bold">
                Probabilistic estimate, not forensic proof.
              </span>
            </div>
            <span className="text-[10px]">
              Trained on ASVspoof 2019 Logical Access Benchmark
            </span>
          </div>
        </div>

        {/* Right 4 Cols: Contextual Rails */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <SummaryPanel />
          <ThresholdSlider />
          <AttackFamilyPanel />
          <ModelPanel />
          <ExportPanel />
        </div>
      </div>

      {/* Docked SoundCloud Transport Bar */}
      <TransportBar />
    </div>
  );
};
