"use client";

import React, { useEffect, useRef } from "react";
import { motion, MotionValue, useTransform } from "framer-motion";
import { getEmberColor } from "@/lib/canvas/colormaps";

interface EvidenceTileProps {
  type: "lfcc" | "waveform";
  stamp: "BONAFIDE" | "SPOOF";
  score: string;
  className?: string;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  depth?: number; // 1 to 5
}

export const EvidenceTile: React.FC<EvidenceTileProps> = ({
  type,
  stamp,
  score,
  className = "",
  mouseX,
  mouseY,
  depth = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const x = useTransform(mouseX, [-500, 500], [-15 * depth, 15 * depth]);
  const y = useTransform(mouseY, [-500, 500], [-15 * depth, 15 * depth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (type === "lfcc") {
      // Procedural Ember heatmap pattern
      const rows = 24;
      const cols = 48;
      const cellW = w / cols;
      const cellH = h / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const harmonic = Math.sin(c * 0.2 + r * 0.4) * 0.5 + 0.5;
          const noise = Math.random() * 0.2;
          const val = Math.min(1, Math.max(0, harmonic + noise));
          ctx.fillStyle = getEmberColor(val);
          ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    } else {
      // Procedural waveform fragment
      ctx.fillStyle = "#111113";
      ctx.fillRect(0, 0, w, h);

      const centerY = h / 2;
      const nBars = 36;
      const barW = w / nBars;

      for (let i = 0; i < nBars; i++) {
        const amp = (Math.sin(i * 0.3) * 0.5 + 0.5) * (h * 0.4) * Math.random();
        ctx.fillStyle = stamp === "SPOOF" ? "rgba(255, 61, 46, 0.85)" : "rgba(198, 255, 61, 0.85)";
        ctx.fillRect(i * barW + 1, centerY - amp, barW - 2, amp * 2);
      }
    }
  }, [type, stamp]);

  const isSpoof = stamp === "SPOOF";

  return (
    <motion.div
      style={{ x, y }}
      className={`absolute z-10 p-2.5 rounded-2xl bg-ink-2/90 border border-line backdrop-blur-md shadow-2xl flex flex-col gap-2 pointer-events-none select-none transition-shadow hover:shadow-bonafide/10 ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isSpoof
              ? "bg-spoof/20 text-spoof border border-spoof/30"
              : "bg-bonafide/20 text-bonafide border border-bonafide/30"
          }`}
        >
          {stamp}
        </span>
        <span className="font-mono text-[10px] text-muted tracking-tight">
          P: {score}
        </span>
      </div>

      <div className="w-36 h-20 rounded-xl overflow-hidden border border-line/50">
        <canvas ref={canvasRef} width={144} height={80} className="w-full h-full" />
      </div>
    </motion.div>
  );
};
