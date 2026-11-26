"use client";

import React from "react";

export const GiantWordmark: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <div
      className={`w-full overflow-hidden select-none py-6 border-t border-line ${className}`}
      aria-label="VOXPROOF brand mark"
    >
      <div className="flex items-baseline justify-between font-display font-black tracking-tighter text-[15vw] leading-[0.78] uppercase">
        <span className="text-white transition-colors duration-300 hover:text-bonafide">
          VOX
        </span>
        <span
          className="text-transparent transition-colors duration-300 hover:text-white"
          style={{
            WebkitTextStroke: "1.5px rgba(255, 255, 255, 0.4)",
          }}
        >
          PROOF
        </span>
      </div>
    </div>
  );
};
