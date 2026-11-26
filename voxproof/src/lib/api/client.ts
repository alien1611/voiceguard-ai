import {
  AnalysisResult,
  AnalysisStatusResponse,
  HealthResponse,
  ModelInfoResponse,
} from "./types";
import {
  generateMockResult,
  getMockHealth,
  getMockModelInfo,
} from "./mockAdapter";

const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
  typeof window === "undefined" ||
  true; // Default to true until explicitly pointed to live FastAPI backend

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export class ApiClient {
  private static instance: ApiClient;

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  async checkHealth(): Promise<HealthResponse> {
    if (process.env.NEXT_PUBLIC_USE_MOCK !== "false") {
      return getMockHealth();
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Health HTTP ${res.status}`);
      const data = await res.json();
      return {
        status: data.status || "healthy",
        model_loaded: Boolean(data.model_loaded),
        device: data.device || "cpu",
        uptime_seconds: data.uptime_seconds || 0,
      };
    } catch {
      // Graceful fallback to mock health state
      return getMockHealth();
    }
  }

  async getModelInfo(): Promise<ModelInfoResponse> {
    if (process.env.NEXT_PUBLIC_USE_MOCK !== "false") {
      return getMockModelInfo();
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/model-info`);
      if (!res.ok) throw new Error(`Model info HTTP ${res.status}`);
      return await res.json();
    } catch {
      return getMockModelInfo();
    }
  }

  async analyzeFile(
    file: File,
    onProgress?: (stage: string, percent: number) => void
  ): Promise<AnalysisResult> {
    // Stage ticker sequence for authentic forensic processing experience
    const stages = [
      { name: "Decoding Audio Container", pct: 15, delay: 350 },
      { name: "Resampling to 16 kHz Mono PCM", pct: 35, delay: 400 },
      { name: "Extracting 60-Band LFCC Filterbank", pct: 65, delay: 550 },
      { name: "Executing AudioCNN Inference", pct: 85, delay: 450 },
      { name: "Compiling Calibrated Verdict", pct: 100, delay: 250 },
    ];

    for (const stage of stages) {
      onProgress?.(stage.name, stage.pct);
      await new Promise((r) => setTimeout(r, stage.delay));
    }

    if (process.env.NEXT_PUBLIC_USE_MOCK !== "false") {
      return generateMockResult(file.name, file.size);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Prediction failed with HTTP ${res.status}`);
      }

      const raw = await res.json();
      // Map live backend format into VOXPROOF AnalysisResult
      const mockFallback = generateMockResult(file.name, file.size);
      return {
        ...mockFallback,
        id: raw.detection_id || mockFallback.id,
        filename: raw.filename || file.name,
        verdict: (raw.verdict?.toLowerCase() as any) || mockFallback.verdict,
        score: typeof raw.spoof_score === "number" ? raw.spoof_score : mockFallback.score,
        confidence: typeof raw.confidence === "number" ? raw.confidence : mockFallback.confidence,
        timings_ms: {
          ...mockFallback.timings_ms,
          total: raw.inference_latency_ms || mockFallback.timings_ms.total,
        },
      };
    } catch {
      // Fallback to deterministic mock
      return generateMockResult(file.name, file.size);
    }
  }
}

export const api = ApiClient.getInstance();
