import { AudioSegment } from "../api/types";
import { getEmberColor } from "./colormaps";

export interface WaveformRenderOptions {
  peaks: number[];
  segments?: AudioSegment[];
  progress: number; // 0.0 to 1.0
  hoverRatio?: number | null; // 0.0 to 1.0
  unplayedColor?: string;
  playedColor?: string;
  showHatching?: boolean;
}

/**
 * Configure high-DPI scaling for HTML5 Canvas.
 */
export function setupDpiCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  return ctx;
}

/**
 * Renders the forensic 280px hero waveform with segment tinting, diagonal hatch, and playhead.
 */
export function drawForensicWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WaveformRenderOptions
) {
  const {
    peaks,
    segments = [],
    progress,
    hoverRatio = null,
    unplayedColor = "#3A3A40",
    playedColor = "#FFFFFF",
    showHatching = true,
  } = options;

  ctx.clearRect(0, 0, width, height);

  const centerY = height / 2;
  const maxAmp = height * 0.44;

  // 1. Draw segment background tints & spoof diagonal hatching
  if (segments.length > 0) {
    const totalDuration = segments[segments.length - 1].end_s;
    for (const seg of segments) {
      const startX = (seg.start_s / totalDuration) * width;
      const endX = (seg.end_s / totalDuration) * width;
      const segWidth = Math.max(1, endX - startX);

      // Subtle ambient wash
      if (seg.verdict === "spoof") {
        ctx.fillStyle = "rgba(255, 61, 46, 0.12)";
        ctx.fillRect(startX, 0, segWidth, height);

        // Forensic diagonal hatching
        if (showHatching) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(startX, 0, segWidth, height);
          ctx.clip();

          ctx.strokeStyle = "rgba(255, 61, 46, 0.25)";
          ctx.lineWidth = 1;
          const step = 10;
          for (let x = startX - height; x < endX + height; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height, height);
          }
          ctx.stroke();
          ctx.restore();
        }
      } else if (seg.verdict === "bonafide") {
        ctx.fillStyle = "rgba(198, 255, 61, 0.08)";
        ctx.fillRect(startX, 0, segWidth, height);
      } else if (seg.verdict === "uncertain") {
        ctx.fillStyle = "rgba(255, 176, 32, 0.10)";
        ctx.fillRect(startX, 0, segWidth, height);
      }

      // Hairline segment separator
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    }
  }

  // 2. Draw center zero axis
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  // 3. Draw vertical waveform bars
  const nBars = Math.min(peaks.length, Math.floor(width / 2.5));
  const barSpacing = width / nBars;
  const barWidth = Math.max(1.2, barSpacing * 0.7);

  const playedX = progress * width;

  for (let i = 0; i < nBars; i++) {
    const peakIdx = Math.floor((i / nBars) * peaks.length);
    const amp = Math.abs(peaks[peakIdx] || 0.05);
    const barHeight = Math.max(3, amp * maxAmp);
    const x = i * barSpacing;

    // Played vs unplayed color
    if (x <= playedX) {
      ctx.fillStyle = playedColor;
    } else {
      ctx.fillStyle = unplayedColor;
    }

    // Draw symmetrical bar
    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
  }

  // 4. Draw played progress head
  ctx.strokeStyle = "#C6FF3D"; // Brand lime playhead
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playedX, 0);
  ctx.lineTo(playedX, height);
  ctx.stroke();

  // 5. Draw hover marker if active
  if (hoverRatio !== null && hoverRatio >= 0 && hoverRatio <= 1) {
    const hoverX = hoverRatio * width;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hoverX, 0);
    ctx.lineTo(hoverX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Renders the 60-band LFCC Heatmap using Ember Colormap.
 */
export function drawLfccHeatmap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: number[][], // [n_coeff][n_frames]
  progress: number
) {
  ctx.clearRect(0, 0, width, height);

  const nCoeff = data.length;
  if (nCoeff === 0) return;
  const nFrames = data[0].length;
  if (nFrames === 0) return;

  const cellWidth = width / nFrames;
  const cellHeight = height / nCoeff;

  // Find min/max for normalization
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let c = 0; c < nCoeff; c++) {
    for (let f = 0; f < nFrames; f++) {
      const v = data[c][f];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  const range = maxVal - minVal || 1;

  // Draw coefficients (lowest frequency at bottom)
  for (let c = 0; c < nCoeff; c++) {
    const y = height - (c + 1) * cellHeight;
    for (let f = 0; f < nFrames; f++) {
      const x = f * cellWidth;
      const normalized = (data[c][f] - minVal) / range;
      ctx.fillStyle = getEmberColor(normalized);
      ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
    }
  }

  // Draw playhead line
  const playheadX = progress * width;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playheadX, 0);
  ctx.lineTo(playheadX, height);
  ctx.stroke();
}

/**
 * Renders per-window spoof probability curve with threshold and uncertain band.
 */
export function drawTimelineCurve(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  segments: AudioSegment[],
  threshold: number = 0.5,
  uncertainBand: [number, number] = [0.42, 0.58],
  progress: number = 0
) {
  ctx.clearRect(0, 0, width, height);
  if (segments.length === 0) return;

  // 1. Draw uncertain band
  const topY = height * (1 - uncertainBand[1]);
  const bottomY = height * (1 - uncertainBand[0]);
  ctx.fillStyle = "rgba(255, 176, 32, 0.08)";
  ctx.fillRect(0, topY, width, bottomY - topY);

  // 2. Draw threshold line
  const threshY = height * (1 - threshold);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, threshY);
  ctx.lineTo(width, threshY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. Draw probability curve
  const points: { x: number; y: number; score: number }[] = [];
  const totalDuration = segments[segments.length - 1].end_s;

  for (const seg of segments) {
    const midTime = (seg.start_s + seg.end_s) / 2;
    const x = (midTime / totalDuration) * width;
    const y = height * (1 - seg.score);
    points.push({ x, y, score: seg.score });
  }

  // Draw gradient filled area under curve
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "rgba(255, 61, 46, 0.3)");
  grad.addColorStop(0.5, "rgba(255, 176, 32, 0.15)");
  grad.addColorStop(1, "rgba(198, 255, 61, 0.05)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, height);
  for (const p of points) {
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(points[points.length - 1].x, height);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw line stroke
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw node points
  for (const p of points) {
    ctx.fillStyle = p.score >= threshold ? "#FF3D2E" : "#C6FF3D";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0A0A0B";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Playhead
  const px = progress * width;
  ctx.strokeStyle = "#C6FF3D";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.stroke();
}
