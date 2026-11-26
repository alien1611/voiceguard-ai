/**
 * VOXPROOF Canvas Colormap Interpolators
 * ======================================
 * Ember Palette: #0A0A0B -> #3B0F0A -> #FF3D2E -> #FFD9A0
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

const EMBER_STOPS: { stop: number; rgb: RGB }[] = [
  { stop: 0.0, rgb: { r: 10, g: 10, b: 11 } },     // #0A0A0B
  { stop: 0.33, rgb: { r: 59, g: 15, b: 10 } },    // #3B0F0A
  { stop: 0.66, rgb: { r: 255, g: 61, b: 46 } },   // #FF3D2E
  { stop: 1.0, rgb: { r: 255, g: 217, b: 160 } },  // #FFD9A0
];

export function getEmberColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));

  for (let i = 0; i < EMBER_STOPS.length - 1; i++) {
    const s1 = EMBER_STOPS[i];
    const s2 = EMBER_STOPS[i + 1];

    if (clamped >= s1.stop && clamped <= s2.stop) {
      const range = s2.stop - s1.stop;
      const factor = (clamped - s1.stop) / range;

      const r = Math.round(s1.rgb.r + factor * (s2.rgb.r - s1.rgb.r));
      const g = Math.round(s1.rgb.g + factor * (s2.rgb.g - s1.rgb.g));
      const b = Math.round(s1.rgb.b + factor * (s2.rgb.b - s1.rgb.b));

      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  return "#FFD9A0";
}

export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const num = parseInt(cleaned, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
