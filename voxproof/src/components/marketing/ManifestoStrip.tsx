"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export const ManifestoStrip: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const text1Ref = useRef<HTMLDivElement | null>(null);
  const text2Ref = useRef<HTMLDivElement | null>(null);
  const text3Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let scrubValue = { progress: 0 };

    const st = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top bottom",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        scrubValue.progress = self.progress;
      },
    });

    let animId: number;

    const render = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const centerY = h / 2;
      const progress = scrubValue.progress; // 0 (organic) to 1 (synthetic jitter)

      ctx.lineWidth = 2;
      ctx.beginPath();

      const nPoints = 200;
      for (let i = 0; i < nPoints; i++) {
        const x = (i / nPoints) * w;
        // Organic smooth sine wave
        const organic = Math.sin(i * 0.1 + time * 0.002) * (h * 0.3);

        // Synthetic jittery rectangular/discontinuous artifact
        const jitterFreq = (i * 0.8) % 1 > 0.5 ? 1 : -1;
        const synthetic = jitterFreq * (h * 0.35) * (Math.sin(time * 0.01) * 0.5 + 0.5);

        // Blend between organic and synthetic based on scroll position
        const y = centerY + (1 - progress) * organic + progress * synthetic;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Color shifts from Bonafide Lime (organic) to Spoof Red (synthetic artifact)
      const r = Math.round(198 + progress * (255 - 198));
      const g = Math.round(255 - progress * (255 - 61));
      const b = Math.round(61 - progress * (61 - 46));
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      st.kill();
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-[85vh] bg-ink-2 border-y border-line flex flex-col justify-center items-center overflow-hidden py-24 select-none"
    >
      {/* Scroll-scrubbed canvas waveform */}
      <canvas
        ref={canvasRef}
        width={1200}
        height={320}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40 object-cover"
      />

      {/* Stacked lines of copy */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-8 text-center flex flex-col items-center gap-4">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-bonafide mb-2">
          // 03. MANIFESTO
        </span>

        <h2 className="font-display font-black text-4xl sm:text-6xl md:text-8xl lg:text-[7vw] uppercase tracking-tighter leading-[0.88] text-white">
          <div ref={text1Ref} className="mask-reveal">
            <span>Frame-level evidence.</span>
          </div>
          <div ref={text2Ref} className="mask-reveal">
            <span className="text-white/80">Explainable verdicts.</span>
          </div>
          <div ref={text3Ref} className="mask-reveal">
            <span className="text-bonafide font-accent italic lowercase tracking-normal font-normal">
              built
            </span>{" "}
            <span>on LFCC + CNN.</span>
          </div>
        </h2>

        <p className="mt-8 font-mono text-xs sm:text-sm text-muted uppercase tracking-widest max-w-xl">
          We reject opaque black boxes. Every classification exposes raw Linear
          Frequency Cepstral Coefficients, windowed likelihood distributions,
          and forensic Grad-CAM saliency.
        </p>
      </div>
    </section>
  );
};
