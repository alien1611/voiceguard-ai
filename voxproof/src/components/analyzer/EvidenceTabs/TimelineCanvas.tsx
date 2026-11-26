"use client";

import React, { useEffect, useRef } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { setupDpiCanvas, drawTimelineCurve } from "@/lib/canvas/renderers";

export const TimelineCanvas: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const currentTime = useAnalyzerStore((s) => s.currentTime);
  const clientThreshold = useAnalyzerStore((s) => s.clientThreshold);

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

    drawTimelineCurve(
      ctx,
      width,
      height,
      result.segments,
      clientThreshold,
      result.model.uncertain_band,
      progress
    );
  }, [result, clientThreshold, progress]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[220px] rounded-xl bg-ink border border-line p-2 relative overflow-hidden"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-3 left-4 flex items-center gap-4 font-mono text-[10px] uppercase text-muted">
        <span>Y-Axis: P(Spoof) [0.0 - 1.0]</span>
        <span>X-Axis: Time Window</span>
      </div>
    </div>
  );
};
