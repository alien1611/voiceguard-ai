import {
  AnalysisResult,
  AudioSegment,
  LfccFeatureMatrix,
  ModelInfoResponse,
  HealthResponse,
  VerdictType,
} from "./types";

/**
 * Deterministic pseudo-random number generator using Mulberry32.
 */
function createPrng(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) + 1337;
}

export function generateMockResult(
  filename: string,
  filesize: number = 1024 * 768
): AnalysisResult {
  const seed = stringToSeed(filename);
  const rand = createPrng(seed);

  const lowerName = filename.toLowerCase();
  let baseScore: number;
  if (lowerName.includes("bonafide") || lowerName.includes("human") || lowerName.includes("real")) {
    baseScore = 0.05 + rand() * 0.18; // 0.05 - 0.23
  } else if (lowerName.includes("spoof") || lowerName.includes("fake") || lowerName.includes("tts") || lowerName.includes("clone")) {
    baseScore = 0.78 + rand() * 0.19; // 0.78 - 0.97
  } else {
    // Deterministic random, biased towards high confidence one way or the other
    const coin = rand();
    baseScore = coin > 0.5 ? 0.75 + rand() * 0.2 : 0.08 + rand() * 0.25;
  }

  const threshold = 0.50;
  const uncertainBand: [number, number] = [0.42, 0.58];

  let verdict: VerdictType;
  if (baseScore >= uncertainBand[0] && baseScore <= uncertainBand[1]) {
    verdict = "uncertain";
  } else if (baseScore >= threshold) {
    verdict = "spoof";
  } else {
    verdict = "bonafide";
  }

  const confidence = Math.round(
    verdict === "spoof"
      ? baseScore * 100
      : verdict === "bonafide"
      ? (1 - baseScore) * 100
      : (0.5 + Math.abs(baseScore - 0.5)) * 100
  );

  const duration_s = 4.0; // Standard 4.0s model window
  const sample_rate = 16000;

  // Generate ~1000 waveform peak points [-1, 1] with speech cadence
  const nPeaks = 1000;
  const waveform_peaks: number[] = [];
  let envelope = 0.1;
  for (let i = 0; i < nPeaks; i++) {
    // Syllabic modulation
    const mod = Math.sin((i / nPeaks) * Math.PI * 14) * 0.5 + 0.5;
    const burst = rand() > 0.92 ? 0.4 : 0;
    envelope = envelope * 0.85 + (mod * 0.6 + burst) * 0.15;
    const val = (rand() * 2 - 1) * Math.min(1.0, envelope);
    waveform_peaks.push(Number(val.toFixed(3)));
  }

  // Generate 8 segmented analysis windows
  const nSegments = 8;
  const segments: AudioSegment[] = [];
  const segDuration = duration_s / nSegments;
  for (let i = 0; i < nSegments; i++) {
    const jitter = (rand() - 0.5) * 0.18;
    const segScore = Math.max(0.01, Math.min(0.99, baseScore + jitter));
    let segVerdict: VerdictType = "uncertain";
    if (segScore >= uncertainBand[1]) segVerdict = "spoof";
    else if (segScore <= uncertainBand[0]) segVerdict = "bonafide";

    segments.push({
      index: i,
      start_s: Number((i * segDuration).toFixed(2)),
      end_s: Number(((i + 1) * segDuration).toFixed(2)),
      score: Number(segScore.toFixed(3)),
      verdict: segVerdict,
    });
  }

  // Generate 60 x 120 downsampled LFCC feature matrix
  const n_coeff = 60;
  const n_frames = 120; // Downsampled for smooth canvas rendering
  const lfccData: number[][] = [];
  for (let c = 0; c < n_coeff; c++) {
    const row: number[] = [];
    for (let f = 0; f < n_frames; f++) {
      // Harmonic bands pattern + higher frequency attenuation
      const decay = Math.exp(-c / 22);
      const harmonic = Math.cos((c / 4) + (f / 15)) * 0.5;
      const noise = (rand() - 0.5) * 0.4;
      let val = (decay * 1.5 + harmonic + noise);
      if (verdict === "spoof" && c > 35) {
        // High frequency unnatural artifacts in synthetic speech
        val += (rand() * 0.8);
      }
      row.push(Number(val.toFixed(3)));
    }
    lfccData.push(row);
  }

  const lfcc: LfccFeatureMatrix = {
    n_coeff,
    n_frames,
    hop_ms: 10,
    data: lfccData,
  };

  // Generate Saliency (Grad-CAM attention overlay on LFCC)
  const saliencyData: number[][] = [];
  for (let c = 0; c < n_coeff; c++) {
    const row: number[] = [];
    for (let f = 0; f < n_frames; f++) {
      // Focus attention on anomalous frames
      const distFromCenter = Math.hypot((c - 30) / 15, (f - 60) / 30);
      const att = Math.max(0, 1 - distFromCenter * 0.6) * (rand() * 0.4 + 0.6);
      row.push(Number(att.toFixed(3)));
    }
    saliencyData.push(row);
  }

  // Attack family breakdown for spoof / uncertain
  const attack_family = verdict === "bonafide"
    ? undefined
    : [
        { label: "Neural Vocoder Artifacts", prob: 0.72 },
        { label: "Diffusion Voice Conversion", prob: 0.18 },
        { label: "Unit Selection Concatenation", prob: 0.10 },
      ];

  const id = `vx_${Math.abs(seed).toString(16).padStart(8, "0")}_${Date.now().toString(36).slice(-4)}`;

  return {
    id,
    filename,
    filesize_bytes: filesize,
    duration_s,
    sample_rate,
    timestamp: new Date().toISOString(),
    model: {
      name: "AudioCNN-22k-LFCC",
      version: "2.1.0",
      threshold,
      uncertain_band: uncertainBand,
      sample_rate,
      n_lfcc: 60,
      frame_length_ms: 25,
      hop_length_ms: 10,
      parameters_count: 24305,
    },
    verdict,
    score: Number(baseScore.toFixed(3)),
    confidence,
    segments,
    waveform_peaks,
    lfcc,
    saliency: saliencyData,
    attack_family,
    timings_ms: {
      decode: 24,
      features: 88,
      inference: 36,
      total: 148,
    },
  };
}

export function getMockModelInfo(): ModelInfoResponse {
  return {
    name: "AudioCNN-22k-LFCC",
    version: "2.1.0",
    architecture: "3-Block Convolutional Neural Network with Batch Normalization & Adaptive Average Pooling",
    parameters: 24305,
    input_shape: "1 x 60 x 398 (Batch x Channels x LFCC x Frames)",
    lfcc: {
      sample_rate: 16000,
      window_length_ms: 25,
      hop_length_ms: 10,
      n_fft: 512,
      n_filters: 60,
      n_coefficients: 60,
      include_deltas: false,
    },
    training: {
      dataset: "ASVspoof 2019 Logical Access (LA) Benchmark",
      subsets: ["train", "dev"],
      bona_fide_samples: 2580,
      spoofed_samples: 22800,
    },
    metrics: {
      eer_percent: 2.84,
      min_t_dc: 0.076,
      accuracy_percent: 97.4,
    },
    limitations: [
      "Optimized for 16 kHz mono acoustic inputs; heavy compression below 8 kHz degrades diagnostic confidence.",
      "Acoustic domain shift: highly reverberant or studio-produced multi-speaker tracks may trigger boundary uncertainty.",
      "Adversarial anti-forensic attacks crafted against LFCC filterbanks are not guaranteed to be captured.",
    ],
  };
}

export function getMockHealth(): HealthResponse {
  return {
    status: "healthy",
    model_loaded: true,
    device: "CPU / PyTorch 2.10 (Local)",
    uptime_seconds: 1420,
  };
}
