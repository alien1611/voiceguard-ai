"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { setupDpiCanvas, drawLfccHeatmap } from "@/lib/canvas/renderers";

export const LfccHeatmap: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const currentTime = useAnalyzerStore((s) => s.currentTime);
  const setCurrentTime = useAnalyzerStore((s) => s.setCurrentTime);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoverVal, setHoverVal] = useState<string | null>(null);

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

    drawLfccHeatmap(ctx, width, height, result.lfcc.data, progress);
  }, [result, progress]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !result) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const coeffIdx = Math.floor(
      (1 - y / rect.height) * result.lfcc.n_coeff
    );
    const frameIdx = Math.floor((x / rect.width) * result.lfcc.n_frames);

    if (
      result.lfcc.data[coeffIdx] &&
      result.lfcc.data[coeffIdx][frameIdx] !== undefined
    ) {
      const val = result.lfcc.data[coeffIdx][frameIdx];
      setHoverVal(`Bin #${coeffIdx} | Frame #${frameIdx} -> ${val.toFixed(3)}`);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !result) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setCurrentTime(ratio * duration);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverVal(null)}
      onClick={handleClick}
      className="w-full h-[220px] rounded-xl bg-ink border border-line p-2 relative overflow-hidden cursor-crosshair"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-3 left-4 flex items-center gap-4 font-mono text-[10px] uppercase text-muted">
        <span>60 Filterbank Bands (Ember Colormap)</span>
        {hoverVal && <span className="text-bonafide font-bold">{hoverVal}</span>}
      </div>
      <div className="absolute bottom-2 right-4 font-mono text-[9px] text-muted">
        Click to Seek Frame
      </div>
    </div>
  );
};
