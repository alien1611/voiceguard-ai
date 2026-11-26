import type { Config } from "tailwindcss";
import { tokens } from "./src/config/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: tokens.colors.ink,
        "ink-2": tokens.colors.ink2,
        "ink-3": tokens.colors.ink3,
        line: tokens.colors.line,
        paper: tokens.colors.paper,
        "paper-ink": tokens.colors.paperInk,
        muted: tokens.colors.muted,
        bonafide: tokens.colors.bonafide,
        spoof: tokens.colors.spoof,
        uncertain: tokens.colors.uncertain,
      },
      fontFamily: {
        display: ["var(--font-archivo)", "sans-serif"],
        accent: ["var(--font-instrument)", "serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      borderRadius: {
        card: tokens.radii.card,
        input: tokens.radii.input,
      },
      transitionTimingFunction: {
        "expo-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      letterSpacing: {
        display: "-0.045em",
        mono: "0.08em",
      },
      lineHeight: {
        display: "0.84",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
