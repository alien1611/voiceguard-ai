"use client";

import React, { useState } from "react";
import { Barcode } from "../common/Barcode";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileAudio,
  Sliders,
  Activity,
  Cpu,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface StepData {
  index: string;
  num: number;
  title: string;
  italicWord: string;
  subtitle: string;
  description: string;
  visualType: "upload" | "normalize" | "lfcc" | "cnn" | "verdict";
}

const steps: StepData[] = [
  {
    index: "01",
    num: 1,
    title: "Lossless Ingestion",
    italicWord: "audio",
    subtitle: "In-memory decoding of WAV, MP3, FLAC containers",
    description:
      "Raw PCM audio stream is intercepted in browser RAM. Zero bytes are written to persistent storage or relayed to external cloud APIs.",
    visualType: "upload",
  },
  {
    index: "02",
    num: 2,
    title: "Acoustic Harmonization",
    italicWord: "standard",
    subtitle: "Downmixing to mono & resampling to 16,000 Hz",
    description:
      "Enforces a fixed 4.0-second analysis aperture (64,000 discrete samples). Zero-padding or symmetric center-trimming eliminates container bias.",
    visualType: "normalize",
  },
  {
    index: "03",
    num: 3,
    title: "LFCC Decomposition",
    italicWord: "spectral",
    subtitle: "60-band Linear Frequency Cepstral Coefficients",
    description:
      "Applies linear filterbanks that capture unnatural high-frequency harmonic energy and phase artifacts characteristic of vocoder synthesis.",
    visualType: "lfcc",
  },
  {
    index: "04",
    num: 4,
    title: "AudioCNN Inference",
    italicWord: "convolutional",
    subtitle: "3-block deep network with batch normalization",
    description:
      "Computes spatial convolutions over the 60 × 398 LFCC feature matrix. Fully local execution on CPU/GPU with deterministic sub-150ms latency.",
    visualType: "cnn",
  },
  {
    index: "05",
    num: 5,
    title: "Forensic Verdict",
    italicWord: "calibrated",
    subtitle: "Explainable frame-level probabilistic classification",
    description:
      "Produces a definitive BONAFIDE or SPOOF verdict, windowed risk scores, acoustic anomaly hotspots, and verifiable cryptographic verification.",
    visualType: "verdict",
  },
];

export const HowItWorks: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const active = steps[currentStep];

  return (
    <section id="how-it-works" className="w-full bg-ink-2 py-28 border-b border-line select-none">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        {/* Header bar with 1 / 5 counter and progress hairline */}
        <div className="flex flex-col gap-4 pb-8 border-b border-line">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-bonafide">
              // 05. METHODOLOGY
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs uppercase tracking-widest text-muted">
                Step {active.num} / {steps.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))
                  }
                  className="p-2 rounded-full bg-ink-3 hover:bg-line text-white transition-colors"
                  aria-label="Previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))
                  }
                  className="p-2 rounded-full bg-ink-3 hover:bg-line text-white transition-colors"
                  aria-label="Next step"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Progress hairline */}
          <div className="w-full h-0.5 bg-ink-3 relative overflow-hidden">
            <motion.div
              className="h-full bg-bonafide"
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* Interactive Step Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-16 items-center">
          {/* Left Text */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <span className="font-mono text-6xl sm:text-8xl font-black text-line">
              {active.index}
            </span>

            <h3 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter leading-[0.9] text-white">
              <span>{active.title.split(" ")[0]}</span>{" "}
              <span className="font-accent italic text-bonafide lowercase font-normal tracking-normal">
                {active.italicWord}
              </span>{" "}
              <span>{active.title.split(" ").slice(1).join(" ")}</span>
            </h3>

            <p className="font-mono text-xs uppercase tracking-widest text-bonafide">
              {active.subtitle}
            </p>

            <p className="text-muted text-base leading-relaxed max-w-lg">
              {active.description}
            </p>

            {/* Step navigation tabs */}
            <div className="flex flex-wrap gap-2 pt-4">
              {steps.map((s, idx) => (
                <button
                  key={s.index}
                  onClick={() => setCurrentStep(idx)}
                  className={`px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider transition-all ${
                    idx === currentStep
                      ? "bg-white text-ink font-bold shadow-md"
                      : "bg-ink-3 text-muted hover:text-white"
                  }`}
                >
                  {s.index}. {s.visualType}
                </button>
              ))}
            </div>
          </div>

          {/* Right Live Animated Visual */}
          <div className="lg:col-span-6">
            <div className="w-full h-[400px] rounded-card bg-ink border border-line p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <span className="font-mono text-xs text-muted uppercase tracking-widest">
                  Live Stage Visualizer
                </span>
                <Barcode value={`VX-STEP-${active.index}`} height={18} showText={false} />
              </div>

              {/* Dynamic Stage Renderers */}
              <div className="flex-1 flex items-center justify-center relative">
                <AnimatePresence mode="wait">
                  {active.visualType === "upload" && (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="w-24 h-24 rounded-2xl bg-ink-2 border border-line flex items-center justify-center text-bonafide shadow-xl">
                        <FileAudio className="w-12 h-12" />
                      </div>
                      <span className="font-mono text-xs uppercase tracking-widest text-white">
                        lossless_audio_stream.wav (16.0 kHz)
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        Zero Disk Write Guarantee
                      </span>
                    </motion.div>
                  )}

                  {active.visualType === "normalize" && (
                    <motion.div
                      key="normalize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="w-full flex flex-col items-center gap-6"
                    >
                      <div className="flex items-center gap-8">
                        <div className="flex flex-col items-center gap-1 font-mono text-[10px] text-muted">
                          <span>Stereo 44.1 kHz</span>
                          <div className="w-12 h-1 bg-muted/30 rounded-full" />
                        </div>
                        <Sliders className="w-8 h-8 text-bonafide animate-pulse" />
                        <div className="flex flex-col items-center gap-1 font-mono text-[10px] text-bonafide">
                          <span>Mono 16.0 kHz</span>
                          <div className="w-12 h-1 bg-bonafide rounded-full" />
                        </div>
                      </div>
                      <div className="w-full max-w-xs p-3 rounded-xl bg-ink-2 border border-line font-mono text-[11px] text-center text-white">
                        64,000 Samples Standard Aperture
                      </div>
                    </motion.div>
                  )}

                  {active.visualType === "lfcc" && (
                    <motion.div
                      key="lfcc"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-full flex flex-col items-center gap-4"
                    >
                      {/* Grid representation of 60 filters */}
                      <div className="grid grid-cols-12 gap-1 w-full max-w-sm h-32 p-2 rounded-xl bg-ink-2 border border-line">
                        {Array.from({ length: 48 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-sm"
                            style={{
                              backgroundColor:
                                i % 3 === 0
                                  ? "#FF3D2E"
                                  : i % 2 === 0
                                  ? "#3B0F0A"
                                  : "#C6FF3D",
                              opacity: 0.3 + (i / 48) * 0.7,
                            }}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                        60-Band Linear Cepstral Heatmap
                      </span>
                    </motion.div>
                  )}

                  {active.visualType === "cnn" && (
                    <motion.div
                      key="cnn"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="flex items-center gap-4"
                    >
                      <div className="p-4 rounded-xl bg-ink-2 border border-line flex flex-col items-center gap-2">
                        <Cpu className="w-8 h-8 text-bonafide animate-bounce" />
                        <span className="font-mono text-[10px] text-white">
                          Conv2D (3x3)
                        </span>
                      </div>
                      <div className="w-6 h-0.5 bg-line" />
                      <div className="p-4 rounded-xl bg-ink-2 border border-line flex flex-col items-center gap-2">
                        <Activity className="w-8 h-8 text-white" />
                        <span className="font-mono text-[10px] text-white">
                          BatchNorm + ReLU
                        </span>
                      </div>
                      <div className="w-6 h-0.5 bg-line" />
                      <div className="p-4 rounded-xl bg-ink-2 border border-line flex flex-col items-center gap-2">
                        <span className="font-mono font-bold text-bonafide text-xs">
                          Sigmoid
                        </span>
                        <span className="font-mono text-[10px] text-white">
                          Score [0, 1]
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {active.visualType === "verdict" && (
                    <motion.div
                      key="verdict"
                      initial={{ opacity: 0, scale: 1.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      className="flex flex-col items-center gap-4 text-center"
                    >
                      <span className="font-display font-black text-6xl uppercase tracking-tight text-bonafide">
                        BONAFIDE
                      </span>
                      <Barcode value="VX-FINAL-SCORE-0082" height={24} />
                      <span className="font-mono text-xs text-muted">
                        Cryptographically Verified Verdict
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-between font-mono text-[10px] text-muted uppercase">
                <span>Phase 0{active.num} Output</span>
                <span>Latency ~25ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
