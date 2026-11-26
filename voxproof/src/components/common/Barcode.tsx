"use client";

import React, { useMemo } from "react";

interface BarcodeProps {
  value: string;
  className?: string;
  height?: number;
  showText?: boolean;
}

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  className = "",
  height = 24,
  showText = true,
}) => {
  // Generate deterministic bar widths from input string
  const bars = useMemo(() => {
    const list: { width: number; isSpace: boolean }[] = [];
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
    }
    const seed = Math.abs(hash) + 1;

    for (let i = 0; i < 34; i++) {
      const pseudo = (seed * (i + 13) * 9301 + 49297) % 233280;
      const r = pseudo / 233280;
      const width = r > 0.7 ? 3 : r > 0.4 ? 2 : 1;
      const isSpace = i % 2 === 1;
      list.push({ width, isSpace });
    }
    return list;
  }, [value]);

  const totalWidth = bars.reduce((acc, b) => acc + b.width, 0);

  return (
    <div className={`inline-flex flex-col items-start gap-1 select-none ${className}`}>
      <svg
        width={totalWidth * 2}
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
        fill="currentColor"
        className="opacity-70"
        aria-hidden="true"
      >
        {bars.reduce(
          (acc, bar, idx) => {
            const x = acc.currentX;
            acc.currentX += bar.width;
            if (!bar.isSpace) {
              acc.elements.push(
                <rect
                  key={idx}
                  x={x}
                  y={0}
                  width={bar.width}
                  height={height}
                  fill="currentColor"
                />
              );
            }
            return acc;
          },
          { currentX: 0, elements: [] as React.ReactNode[] }
        ).elements}
      </svg>
      {showText && (
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted">
          *{value.slice(0, 14)}*
        </span>
      )}
    </div>
  );
};
