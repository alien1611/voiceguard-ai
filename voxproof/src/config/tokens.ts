/**
 * VOXPROOF Design Tokens
 * ======================
 * Central tokens dictionary defining colors, typography, shapes, and easing.
 */

export const tokens = {
  colors: {
    ink: "#0A0A0B",
    ink2: "#111113",
    ink3: "#1A1A1D",
    line: "rgba(255, 255, 255, 0.10)",
    lineHover: "rgba(255, 255, 255, 0.22)",
    paper: "#EEEBE4",
    paperInk: "#111113",
    muted: "#8B8B92",
    bonafide: "#C6FF3D", // Acid lime (brand accent)
    spoof: "#FF3D2E",    // Forensic red
    uncertain: "#FFB020",// Forensic amber
    waveform: {
      unplayed: "#3A3A40",
      played: "#FFFFFF",
      bonafideOverlay: "rgba(198, 255, 61, 0.35)",
      spoofOverlay: "rgba(255, 61, 46, 0.45)",
      uncertainOverlay: "rgba(255, 176, 32, 0.40)",
    },
    emberHeatmap: [
      { stop: 0.0, color: "#0A0A0B" },
      { stop: 0.33, color: "#3B0F0A" },
      { stop: 0.66, color: "#FF3D2E" },
      { stop: 1.0, color: "#FFD9A0" },
    ],
  },
  typography: {
    display: "'Archivo', sans-serif",
    accent: "'Instrument Serif', serif",
    mono: "'JetBrains Mono', monospace",
    body: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  radii: {
    card: "20px",
    input: "14px",
    pill: "9999px",
  },
  easing: {
    expoOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    standard: "cubic-bezier(0.2, 0, 0, 1)",
  },
  durations: {
    reveal: "1.0s",
    hover: "0.3s",
  },
} as const;
