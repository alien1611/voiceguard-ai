"use client";

import React, { useEffect, useRef } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { setupDpiCanvas } from "@/lib/canvas/renderers";

export const SaliencyCanvas: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !result?.saliency) return;

    const width = container.clientWidth;
    const height = 220;

    const ctx = setupDpiCanvas(canvas, width, height);
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const saliency = result.saliency;
    const nRows = saliency.length;
    const nCols = saliency[0].length;

    const cellW = width / nCols;
    const cellH = height / nRows;

    // Draw Grad-CAM attention heatmap (Red high attention -> Blue low attention)
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const val = Math.max(0, Math.min(1, saliency[r][c]));
        // High attention highlighted in acid lime / red
        const alpha = val * 0.85;
        ctx.fillStyle = `rgba(255, 61, 46, ${alpha})`;
        ctx.fillRect(c * cellW, height - (r + 1) * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  }, [result]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[220px] rounded-xl bg-ink border border-line p-2 relative overflow-hidden"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-3 left-4 flex items-center gap-4 font-mono text-[10px] uppercase text-muted">
        <span>Grad-CAM Activation Weights (Convolutional Layer 3)</span>
      </div>
    </div>
  );
};
