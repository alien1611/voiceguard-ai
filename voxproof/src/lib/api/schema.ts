import { z } from "zod";

export const VerdictSchema = z.enum(["bonafide", "spoof", "uncertain"]);

export const AudioSegmentSchema = z.object({
  index: z.number(),
  start_s: z.number(),
  end_s: z.number(),
  score: z.number().min(0).max(1),
  verdict: VerdictSchema,
});

export const LfccMatrixSchema = z.object({
  n_coeff: z.number(),
  n_frames: z.number(),
  hop_ms: z.number(),
  data: z.array(z.array(z.number())),
});

export const AnalysisResultSchema = z.object({
  id: z.string(),
  filename: z.string(),
  filesize_bytes: z.number(),
  duration_s: z.number(),
  sample_rate: z.number(),
  timestamp: z.string(),
  model: z.object({
    name: z.string(),
    version: z.string(),
    threshold: z.number(),
    uncertain_band: z.tuple([z.number(), z.number()]),
  }),
  verdict: VerdictSchema,
  score: z.number().min(0).max(1),
  confidence: z.number(),
  segments: z.array(AudioSegmentSchema),
  waveform_peaks: z.array(z.number()),
  lfcc: LfccMatrixSchema,
  timings_ms: z.object({
    decode: z.number(),
    features: z.number(),
    inference: z.number(),
    total: z.number(),
  }),
});
