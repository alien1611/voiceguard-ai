"use client";

import React from "react";
import { siteConfig } from "@/config/site";

export const Marquee: React.FC<{
  items?: string[];
  speed?: string;
  className?: string;
}> = ({
  items = siteConfig.attackFamilies,
  speed = "32s",
  className = "",
}) => {
  return (
    <div
      className={`relative w-full overflow-hidden border-y border-line py-4 bg-ink-2 select-none ${className}`}
      aria-hidden="true"
    >
      <div
        className="flex whitespace-nowrap animate-marquee"
        style={{ animationDuration: speed }}
      >
        {[...items, ...items, ...items, ...items].map((item, idx) => (
          <div key={idx} className="flex items-center mx-6">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {item}
            </span>
            <span className="mx-6 text-bonafide font-mono text-xs">/</span>
          </div>
        ))}
      </div>
    </div>
  );
};
