"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Preloader: React.FC<{ onComplete?: () => void }> = ({
  onComplete,
}) => {
  const [count, setCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Only show on first visit in session
    if (sessionStorage.getItem("voxproof_preloaded") === "true") {
      setIsFinished(true);
      onComplete?.();
      return;
    }

    const startTime = performance.now();
    const duration = 1600; // Under 2.0s

    let animationFrameId: number;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      const currentCount = Math.floor(progress * 100);
      setCount(currentCount);

      // Draw progressive waveform
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.strokeStyle = "#C6FF3D";
          ctx.lineWidth = 1.5;
          ctx.beginPath();

          const centerY = h / 2;
          const nPoints = 80;
          const visiblePoints = Math.floor(nPoints * progress);

          for (let i = 0; i <= visiblePoints; i++) {
            const x = (i / nPoints) * w;
            const amp =
              Math.sin(i * 0.4 + time * 0.005) *
              Math.sin(i * 0.15) *
              (h * 0.38);
            const y = centerY + amp;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        sessionStorage.setItem("voxproof_preloaded", "true");
        setTimeout(() => {
          setIsFinished(true);
          onComplete?.();
        }, 200);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleSkip = () => {
      sessionStorage.setItem("voxproof_preloaded", "true");
      setIsFinished(true);
      onComplete?.();
    };

    window.addEventListener("keydown", handleSkip);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleSkip);
    };
  }, [onComplete]);

  if (isFinished) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
        exit={{
          clipPath: "polygon(0 0, 100% 0, 100% 0%, 0 0%)",
          transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
        }}
        className="fixed inset-0 z-[100] bg-ink flex flex-col items-center justify-center p-8 select-none"
        onClick={() => {
          sessionStorage.setItem("voxproof_preloaded", "true");
          setIsFinished(true);
          onComplete?.();
        }}
      >
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div className="w-full flex items-center justify-between font-mono text-xs uppercase tracking-[0.2em] text-muted">
            <span className="text-bonafide">// INITIALIZING LFCC KERNELS</span>
            <span>PRESS ANY KEY TO SKIP</span>
          </div>

          {/* Waveform Canvas */}
          <div className="w-full h-20 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={400}
              height={80}
              className="w-full h-full"
            />
          </div>

          {/* Counter */}
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-7xl sm:text-8xl tracking-tight text-white">
              {count.toString().padStart(3, "0")}
            </span>
            <span className="font-mono text-sm text-bonafide">%</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
