"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMotionValue } from "framer-motion";
import { EvidenceTile } from "./EvidenceTile";
import { Barcode } from "../common/Barcode";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { ArrowDown, UploadCloud } from "lucide-react";

export const Hero: React.FC = () => {
  const router = useRouter();
  const setFile = useAnalyzerStore((s) => s.setFile);
  const [isDragOver, setIsDragOver] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      router.push("/analyze");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      router.push("/analyze");
    }
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`relative min-h-screen w-full bg-ink flex flex-col justify-between pt-28 pb-12 px-4 sm:px-8 select-none transition-colors duration-300 ${
        isDragOver ? "bg-ink-2 ring-2 ring-bonafide ring-inset" : ""
      }`}
    >
      {/* Floating Evidence Tiles (Procedural Canvas Tiles with Depth) */}
      <div className="hidden lg:block pointer-events-none">
        <EvidenceTile
          type="lfcc"
          stamp="SPOOF"
          score="0.942"
          className="top-36 left-12"
          depth={2.2}
          mouseX={mouseX}
          mouseY={mouseY}
        />
        <EvidenceTile
          type="waveform"
          stamp="BONAFIDE"
          score="0.081"
          className="top-40 right-16"
          depth={1.5}
          mouseX={mouseX}
          mouseY={mouseY}
        />
        <EvidenceTile
          type="lfcc"
          stamp="BONAFIDE"
          score="0.124"
          className="bottom-44 left-24"
          depth={3.0}
          mouseX={mouseX}
          mouseY={mouseY}
        />
        <EvidenceTile
          type="waveform"
          stamp="SPOOF"
          score="0.879"
          className="bottom-36 right-28"
          depth={2.0}
          mouseX={mouseX}
          mouseY={mouseY}
        />
      </div>

      {/* Top Meta Line */}
      <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between font-mono text-xs uppercase tracking-[0.2em] text-muted">
        <span className="text-bonafide">// 01. ACOUSTIC FORENSICS</span>
        <span>LFCC + AUDIOCNN 22K</span>
      </div>

      {/* Main Giant Stacked Headline */}
      <div className="w-full max-w-[1440px] mx-auto my-auto flex flex-col items-center justify-center text-center">
        <h1 className="font-display font-black text-5xl sm:text-7xl md:text-9xl lg:text-[11vw] uppercase tracking-tighter leading-[0.84] text-white flex flex-col">
          <span>KNOW</span>
          <span>WHO&apos;S</span>
          <span className="font-accent italic text-bonafide lowercase tracking-normal -my-1 md:-my-3 font-normal">
            really
          </span>
          <span>SPEAKING</span>
        </h1>

        {/* Center Drop Audio Pill */}
        <div className="mt-10 sm:mt-14 z-20">
          <label
            htmlFor="hero-dropzone-input"
            data-cursor="DROP"
            className="cursor-pointer group px-8 py-4 sm:px-10 sm:py-5 rounded-full bg-ink-2 border border-line hover:border-bonafide flex items-center gap-4 transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-md"
          >
            <UploadCloud className="w-5 h-5 text-bonafide group-hover:scale-110 transition-transform" />
            <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-white group-hover:text-bonafide transition-colors">
              Drop Audio To Analyze (.wav, .mp3, .flac)
            </span>
            <input
              id="hero-dropzone-input"
              type="file"
              accept=".wav,.mp3,.flac,.ogg,.m4a"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="w-full max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-end pt-8 border-t border-line">
        {/* Bottom Left Supporting Copy */}
        <div className="md:col-span-6 flex flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-wider text-white">
            Forensic artifact discrimination engine.
          </p>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Frame-level spectral energy decomposition at 16 kHz. Zero data retention.
          </p>
        </div>

        {/* Bottom Right Scroll Cue */}
        <div className="md:col-span-6 flex items-center justify-between md:justify-end gap-6">
          <Barcode value="VX-HERO-001" height={20} showText={false} />
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
            <span>Scroll Down</span>
            <ArrowDown className="w-3.5 h-3.5 text-bonafide animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
};
