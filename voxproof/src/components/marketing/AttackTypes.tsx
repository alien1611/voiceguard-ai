"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, List, Grid } from "lucide-react";
import { Barcode } from "../common/Barcode";

interface AttackItem {
  id: string;
  name: string;
  tag: string;
  description: string;
  anomalySignature: string;
}

const attacks: AttackItem[] = [
  {
    id: "00",
    name: "Text-to-Speech (TTS)",
    tag: "Neural Autoregressive / Non-Autoregressive",
    description:
      "Acoustic models synthesizing pitch contours from raw phonemes. LFCC detects synthetic phase discontinuities and unnatural fundamental frequency variance.",
    anomalySignature: "Over-smoothed high-frequency formant energy",
  },
  {
    id: "01",
    name: "Voice Conversion (VC)",
    tag: "Latent Diffusion & VAE Embeddings",
    description:
      "Source speaker vocal tract modulated to clone target timbre. Leaves telltale spectral smearing across 4 kHz - 8 kHz linear bins.",
    anomalySignature: "Vocal tract transfer function mismatches",
  },
  {
    id: "02",
    name: "Neural Vocoder Artifacts",
    tag: "HiFi-GAN, WaveGlow, BigVGAN",
    description:
      "Waveform generation from mel-spectrograms introduces sub-harmonic periodicity errors and periodic checkerboard patterns in linear filterbanks.",
    anomalySignature: "Unnatural phase coherence at frame boundaries",
  },
  {
    id: "03",
    name: "Replay & Transmission Attacks",
    tag: "Acoustic Transducer Reflection",
    description:
      "Pre-recorded legitimate voice played through physical loudspeakers into a microphone. Introduces room impulse response and speaker distortion.",
    anomalySignature: "Acoustic channel frequency coloration",
  },
  {
    id: "04",
    name: "Zero-Shot Cloned Voices",
    tag: "Few-Second Timbre Prompting",
    description:
      "High-fidelity cloning from 3-second audio prompts. Lacks micro-tremor biological dynamics in steady vowels and glottal pulses.",
    anomalySignature: "Absence of organic vocal fold jitter/shimmer",
  },
];

export const AttackTypes: React.FC = () => {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <section className="w-full bg-ink py-28 border-b border-line select-none">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        {/* Header & List / Grid toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between pb-12 border-b border-line gap-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-bonafide block mb-3">
              // 06. THREAT TAXONOMY
            </span>
            <h2 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter leading-[0.9] text-white">
              DETECTED SYNTHESIS <br />
              <span className="font-accent italic text-bonafide lowercase font-normal tracking-normal">
                attack
              </span>{" "}
              FAMILIES.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">
              Showing 05 Threat Vectors
            </span>

            {/* List / Grid Toggle */}
            <div className="flex items-center bg-ink-2 p-1 rounded-full border border-line">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-full transition-colors ${
                  viewMode === "list" ? "bg-white text-ink" : "text-muted hover:text-white"
                }`}
                title="List View"
                aria-label="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-full transition-colors ${
                  viewMode === "grid" ? "bg-white text-ink" : "text-muted hover:text-white"
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content View */}
        {viewMode === "list" ? (
          <div className="divide-y divide-line">
            {attacks.map((item, idx) => (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                data-cursor="VIEW"
                className="group py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors hover:bg-ink-2/60 px-4 rounded-xl"
              >
                <div className="flex items-baseline gap-6">
                  <span className="font-mono text-xs text-muted group-hover:text-bonafide transition-colors">
                    {item.id}
                  </span>
                  <div className="flex flex-col">
                    <h3 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight text-white group-hover:text-bonafide transition-colors">
                      {item.name}
                    </h3>
                    <span className="font-mono text-xs text-muted mt-1 uppercase tracking-wider">
                      {item.tag}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-8 md:text-right">
                  <div className="hidden lg:block max-w-sm">
                    <span className="font-mono text-[11px] text-muted line-clamp-2">
                      {item.description}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-muted group-hover:border-bonafide group-hover:text-bonafide group-hover:translate-x-1 group-hover:-translate-y-1 transition-all">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-12">
            {attacks.map((item) => (
              <div
                key={item.id}
                className="p-6 rounded-card bg-ink-2 border border-line flex flex-col justify-between h-72 hover:border-bonafide/50 transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-line">
                    <span className="font-mono text-xs text-muted">{item.id}</span>
                    <Barcode value={`ATK-${item.id}`} height={16} showText={false} />
                  </div>
                  <h3 className="font-display font-black text-2xl uppercase tracking-tight text-white mt-4 group-hover:text-bonafide transition-colors">
                    {item.name}
                  </h3>
                  <span className="font-mono text-[10px] text-bonafide uppercase tracking-wider block mt-1">
                    {item.tag}
                  </span>
                  <p className="text-muted text-xs mt-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="pt-4 border-t border-line flex items-center justify-between font-mono text-[10px] text-muted">
                  <span>Signatures: {item.anomalySignature.slice(0, 24)}...</span>
                  <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-bonafide transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
