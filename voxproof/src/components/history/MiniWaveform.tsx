"use client";

import React, { useEffect, useRef } from "react";
import { setupDpiCanvas } from "@/lib/canvas/renderers";

export const MiniWaveform: React.FC<{
  peaks: number[];
  verdict: "bonafide" | "spoof" | "uncertain";
  width?: number;
  height?: number;
}> = ({ peaks, verdict, width = 120, height = 36 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupDpiCanvas(canvas, width, height);
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const color =
      verdict === "spoof"
        ? "#FF3D2E"
        : verdict === "bonafide"
        ? "#C6FF3D"
        : "#FFB020";

    const centerY = height / 2;
    const nBars = Math.min(peaks.length, 30);
    const barSpacing = width / nBars;
    const barW = Math.max(1, barSpacing * 0.7);

    for (let i = 0; i < nBars; i++) {
      const idx = Math.floor((i / nBars) * peaks.length);
      const amp = Math.abs(peaks[idx] || 0.1) * (height * 0.45);
      ctx.fillStyle = color;
      ctx.fillRect(i * barSpacing, centerY - amp, barW, amp * 2);
    }
  }, [peaks, verdict, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg bg-ink-3/60 border border-line"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};
