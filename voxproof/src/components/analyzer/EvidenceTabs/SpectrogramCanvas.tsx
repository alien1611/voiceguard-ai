"use client";

import React, { useEffect, useRef } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { setupDpiCanvas } from "@/lib/canvas/renderers";

export const SpectrogramCanvas: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const currentTime = useAnalyzerStore((s) => s.currentTime);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const duration = result?.duration_s || 4.0;
  const progress = Math.min(1, Math.max(0, currentTime / duration));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !result) return;

    const width = container.clientWidth;
    const height = 220;

    const ctx = setupDpiCanvas(canvas, width, height);
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Render simulated 2D STFT spectrogram
    const nBins = 80;
    const nFrames = 160;
    const cellW = width / nFrames;
    const cellH = height / nBins;

    for (let f = 0; f < nFrames; f++) {
      for (let b = 0; b < nBins; b++) {
        const freqRatio = b / nBins;
        // Natural speech decays exponentially with frequency
        const energy =
          Math.exp(-freqRatio * 3.2) *
          (Math.sin(f * 0.15 + b * 0.3) * 0.4 + 0.6);
        const intensity = Math.floor(Math.min(255, energy * 255));

        ctx.fillStyle = `rgb(${intensity}, ${Math.floor(intensity * 0.85)}, ${Math.floor(intensity * 0.4)})`;
        ctx.fillRect(f * cellW, height - (b + 1) * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Draw playhead
    const px = progress * width;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();
  }, [result, progress]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[220px] rounded-xl bg-ink border border-line p-2 relative overflow-hidden"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-3 left-4 flex items-center gap-4 font-mono text-[10px] uppercase text-muted">
        <span>Linear STFT Spectrum (0 - 8,000 Hz)</span>
      </div>
    </div>
  );
};
