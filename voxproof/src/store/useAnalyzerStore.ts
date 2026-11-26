import { create } from "zustand";
import { AnalysisResult, VerdictType } from "@/lib/api/types";

interface AnalyzerState {
  file: File | null;
  status: "idle" | "processing" | "done" | "error";
  stage: string;
  stageProgress: number;
  result: AnalysisResult | null;
  error: string | null;

  // Playback state
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  volume: number;
  loopSegmentIndex: number | null;

  // Active evidence tab
  activeTab: "timeline" | "lfcc" | "spectrogram" | "saliency" | "raw";

  // Re-threshold slider (0.0 to 1.0)
  clientThreshold: number;

  // Actions
  setFile: (file: File | null) => void;
  setStatus: (status: AnalyzerState["status"]) => void;
  setStage: (stage: string, progress: number) => void;
  setResult: (result: AnalysisResult | null) => void;
  setError: (err: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (vol: number) => void;
  setLoopSegmentIndex: (idx: number | null) => void;
  setActiveTab: (tab: AnalyzerState["activeTab"]) => void;
  setClientThreshold: (val: number) => void;
  reset: () => void;

  // Computed helper
  getCalibratedVerdict: () => {
    verdict: VerdictType;
    score: number;
    confidence: number;
  };
}

export const useAnalyzerStore = create<AnalyzerState>((set, get) => ({
  file: null,
  status: "idle",
  stage: "",
  stageProgress: 0,
  result: null,
  error: null,

  isPlaying: false,
  currentTime: 0,
  playbackSpeed: 1.0,
  volume: 1.0,
  loopSegmentIndex: null,

  activeTab: "timeline",
  clientThreshold: 0.5,

  setFile: (file) => set({ file }),
  setStatus: (status) => set({ status }),
  setStage: (stage, stageProgress) => set({ stage, stageProgress }),
  setResult: (result) =>
    set({
      result,
      status: result ? "done" : "idle",
      clientThreshold: result?.model.threshold ?? 0.5,
    }),
  setError: (error) => set({ error, status: "error" }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setVolume: (volume) => set({ volume }),
  setLoopSegmentIndex: (loopSegmentIndex) => set({ loopSegmentIndex }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setClientThreshold: (clientThreshold) => set({ clientThreshold }),

  reset: () =>
    set({
      file: null,
      status: "idle",
      stage: "",
      stageProgress: 0,
      result: null,
      error: null,
      isPlaying: false,
      currentTime: 0,
      loopSegmentIndex: null,
    }),

  getCalibratedVerdict: () => {
    const { result, clientThreshold } = get();
    if (!result) return { verdict: "uncertain", score: 0.5, confidence: 50 };

    const score = result.score;
    const band = 0.05; // Ambiguity margin around custom threshold
    let verdict: VerdictType = "uncertain";

    if (score >= clientThreshold + band) {
      verdict = "spoof";
    } else if (score <= clientThreshold - band) {
      verdict = "bonafide";
    }

    const confidence = Math.round(
      verdict === "spoof"
        ? Math.min(99, score * 100)
        : verdict === "bonafide"
        ? Math.min(99, (1 - score) * 100)
        : 50
    );

    return { verdict, score, confidence };
  },
}));
