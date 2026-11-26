"use client";

import React, { useEffect, useRef } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { Barcode } from "../common/Barcode";
import { X, RefreshCw, Cpu, Layers } from "lucide-react";
import { getEmberColor } from "@/lib/canvas/colormaps";

const stages = [
  { id: "decode", label: "Decoding Audio Container" },
  { id: "resample", label: "Resampling to 16 kHz Mono PCM" },
  { id: "extract_lfcc", label: "Extracting 60-Band LFCC Filterbank" },
  { id: "cnn_inference", label: "Executing AudioCNN Inference" },
  { id: "score", label: "Compiling Calibrated Verdict" },
];

export const ProcessingStage: React.FC = () => {
  const file = useAnalyzerStore((s) => s.file);
  const stage = useAnalyzerStore((s) => s.stage);
  const stageProgress = useAnalyzerStore((s) => s.stageProgress);
  const reset = useAnalyzerStore((s) => s.reset);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let scanX = 0;

    const render = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Render partially building LFCC columns based on stageProgress
      const cols = 60;
      const rows = 24;
      const maxCol = Math.floor((stageProgress / 100) * cols);

      const cellW = w / cols;
      const cellH = h / rows;

      for (let c = 0; c < maxCol; c++) {
        for (let r = 0; r < rows; r++) {
          const val = (Math.sin(c * 0.2 + r * 0.4 + time * 0.003) * 0.5 + 0.5);
          ctx.fillStyle = getEmberColor(val);
          ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
        }
      }

      // Sweeping laser scanner line
      scanX = (scanX + 4) % w;
      ctx.strokeStyle = "#C6FF3D";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, h);
      ctx.stroke();

      // Laser glow
      const grad = ctx.createLinearGradient(scanX - 30, 0, scanX, 0);
      grad.addColorStop(0, "rgba(198, 255, 61, 0)");
      grad.addColorStop(1, "rgba(198, 255, 61, 0.35)");
      ctx.fillStyle = grad;
      ctx.fillRect(scanX - 30, 0, 30, h);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [stageProgress]);

  return (
    <div className="w-full max-w-3xl mx-auto py-12 flex flex-col gap-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-line">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-bonafide animate-spin" />
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-bonafide block">
              // PROCESSING PIPELINE
            </span>
            <span className="font-mono text-xs text-white font-bold truncate max-w-sm block">
              {file?.name || "audio_target.wav"}
            </span>
          </div>
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-ink-2 hover:bg-ink-3 border border-line text-xs font-mono text-muted hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
      </div>

      {/* Sweeping Laser & Building LFCC Heatmap Visualizer */}
      <div className="w-full h-48 rounded-card bg-ink border border-line overflow-hidden relative shadow-2xl">
        <canvas ref={canvasRef} width={640} height={192} className="w-full h-full" />
        <div className="absolute top-3 left-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted/80 bg-ink/70 px-2 py-1 rounded backdrop-blur-sm border border-line">
          <Layers className="w-3 h-3 text-bonafide" />
          <span>Sweeping Spectral Frames</span>
        </div>
      </div>

      {/* 5-Stage Ticker */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-muted">
          <span>Active Phase: {stage || "Initializing..."}</span>
          <span className="text-bonafide font-bold">{stageProgress}%</span>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full h-2 rounded-full bg-ink-2 overflow-hidden border border-line">
          <div
            className="h-full bg-bonafide transition-all duration-300"
            style={{ width: `${stageProgress}%` }}
          />
        </div>

        {/* Individual Stage Indicators */}
        <div className="grid grid-cols-5 gap-2 pt-4">
          {stages.map((st, idx) => {
            const isCompleted = stageProgress >= (idx + 1) * 20;
            const isCurrent =
              stageProgress >= idx * 20 && stageProgress < (idx + 1) * 20;

            return (
              <div
                key={st.id}
                className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
                  isCompleted
                    ? "bg-bonafide/10 border-bonafide/30 text-bonafide"
                    : isCurrent
                    ? "bg-ink-2 border-line text-white animate-pulse"
                    : "bg-ink-3/40 border-line/40 text-muted/60"
                }`}
              >
                <span className="font-mono text-[9px] uppercase tracking-widest font-bold">
                  0{idx + 1}
                </span>
                <span className="font-mono text-[10px] leading-tight line-clamp-2">
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="flex items-center justify-between pt-4 border-t border-line">
        <Barcode value="VX-STAGE-EXEC" height={16} showText={false} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Zero Waveform Retention · RAM Processing Only
        </span>
      </div>
    </div>
  );
};
