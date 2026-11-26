"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { setupDpiCanvas, drawForensicWaveform } from "@/lib/canvas/renderers";

export const HeroWaveform: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const currentTime = useAnalyzerStore((s) => s.currentTime);
  const isPlaying = useAnalyzerStore((s) => s.isPlaying);
  const setCurrentTime = useAnalyzerStore((s) => s.setCurrentTime);
  const setIsPlaying = useAnalyzerStore((s) => s.setIsPlaying);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    text: string;
  } | null>(null);

  const duration = result?.duration_s || 4.0;
  const progress = Math.min(1, Math.max(0, currentTime / duration));

  // Redraw canvas whenever progress or hover changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !result) return;

    const width = container.clientWidth;
    const height = 280;

    const ctx = setupDpiCanvas(canvas, width, height);
    if (!ctx) return;

    drawForensicWaveform(ctx, width, height, {
      peaks: result.waveform_peaks,
      segments: result.segments,
      progress,
      hoverRatio,
      unplayedColor: "#3A3A40",
      playedColor: "#FFFFFF",
      showHatching: true,
    });
  }, [result, progress, hoverRatio]);

  // Spacebar keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying]);

  // Mouse seek and hover tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !result) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = x / rect.width;
    setHoverRatio(ratio);

    const time = ratio * duration;
    const mm = Math.floor(time / 60)
      .toString()
      .padStart(2, "0");
    const ss = (time % 60).toFixed(1).padStart(4, "0");

    // Find segment at this timestamp
    const seg = result.segments.find(
      (s) => time >= s.start_s && time <= s.end_s
    );
    const score = seg ? seg.score.toFixed(2) : result.score.toFixed(2);
    const label = seg ? seg.verdict : result.verdict;

    setTooltip({
      x,
      text: `${mm}:${ss} -> ${score} ${label.toUpperCase()}`,
    });
  };

  const handleMouseLeave = () => {
    setHoverRatio(null);
    setTooltip(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !result) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = x / rect.width;
    setCurrentTime(ratio * duration);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative w-full h-[280px] bg-ink rounded-2xl border border-line overflow-hidden cursor-crosshair select-none shadow-2xl"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating Hover Tooltip */}
      {tooltip && (
        <div
          className="absolute top-3 pointer-events-none -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-ink-2/95 border border-line text-white font-mono text-[11px] shadow-xl backdrop-blur-md whitespace-nowrap"
          style={{ left: `${tooltip.x}px` }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Acoustic Timestamp labels */}
      <div className="absolute bottom-2 left-4 right-4 flex justify-between pointer-events-none font-mono text-[10px] text-muted">
        <span>00:00.0</span>
        <span>
          00:{duration.toFixed(1).padStart(4, "0")} (64,000 SAMPLES)
        </span>
      </div>
    </div>
  );
};
