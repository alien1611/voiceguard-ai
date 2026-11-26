/**
 * VOXPROOF API Types & Data Contracts
 * ===================================
 * Complete TypeScript definitions matching Section 6 of the specification.
 */

export type VerdictType = "bonafide" | "spoof" | "uncertain";

export interface ModelMetadata {
  name: string;
  version: string;
  threshold: number;
  uncertain_band: [number, number]; // e.g. [0.42, 0.58]
  sample_rate?: number;
  n_lfcc?: number;
  frame_length_ms?: number;
  hop_length_ms?: number;
  parameters_count?: number;
}

export interface AudioSegment {
  index: number;
  start_s: number;
  end_s: number;
  score: number; // 0.0 (bonafide) -> 1.0 (spoof)
  verdict: VerdictType;
}

export interface LfccFeatureMatrix {
  n_coeff: number; // 60
  n_frames: number; // e.g. 398
  hop_ms: number;
  data: number[][]; // [n_coeff][n_frames] normalized coefficients
}

export interface SpectrogramData {
  n_bins: number;
  n_frames: number;
  data: number[][];
}

export interface AttackFamilyPrediction {
  label: string;
  prob: number; // 0.0 -> 1.0
}

export interface AnalysisTimings {
  decode: number; // ms
  features: number; // ms
  inference: number; // ms
  total: number; // ms
}

export interface AnalysisResult {
  id: string;
  filename: string;
  filesize_bytes: number;
  duration_s: number;
  sample_rate: number;
  timestamp: string;
  model: ModelMetadata;
  verdict: VerdictType;
  score: number; // 0..1 spoof probability
  confidence: number; // 50..100%
  segments: AudioSegment[];
  waveform_peaks: number[]; // ~1000 points normalized [-1, 1]
  lfcc: LfccFeatureMatrix;
  spectrogram?: SpectrogramData;
  saliency?: number[][]; // Grad-CAM attention matrix over LFCC
  attack_family?: AttackFamilyPrediction[];
  timings_ms: AnalysisTimings;
}

export interface AnalysisStatusResponse {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  stage?: "decode" | "resample" | "extract_lfcc" | "cnn_inference" | "score";
  progress?: number; // 0..100
  result?: AnalysisResult;
  error?: string;
}

export interface ModelInfoResponse {
  name: string;
  version: string;
  architecture: string;
  parameters: number;
  input_shape: string;
  lfcc: {
    sample_rate: number;
    window_length_ms: number;
    hop_length_ms: number;
    n_fft: number;
    n_filters: number;
    n_coefficients: number;
    include_deltas: boolean;
  };
  training: {
    dataset: string;
    subsets: string[];
    bona_fide_samples: number;
    spoofed_samples: number;
  };
  metrics?: {
    eer_percent?: number;
    min_t_dc?: number;
    accuracy_percent?: number;
  };
  limitations: string[];
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "offline";
  model_loaded: boolean;
  device: string;
  uptime_seconds: number;
}
