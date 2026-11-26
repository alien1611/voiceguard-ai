# VOXPROOF – Architecture & Execution Plan

## 1. Project Overview & Working Constants
- **Brand / Product Constant**: `VOXPROOF` (defined in `src/config/site.ts`)
- **Tagline**: Forensic voice-authenticity intelligence.
- **Classification Engine**: Deep Convolutional Neural Network (AudioCNN) trained on 60-band Linear Frequency Cepstral Coefficients (LFCC) for frame-level artifact detection.
- **Verdict Classes**:
  - `BONAFIDE` (`#C6FF3D`, acid lime): Genuine organic human vocal tract resonance.
  - `SPOOF` (`#FF3D2E`, signal red): Synthetic speech, neural vocoders, voice conversion, replay artifacts.
  - `UNCERTAIN` (`#FFB020`, amber): Near decision boundary within the ambiguity band.
- **Privacy & Retention Policy**: Transient memory-only processing. Zero audio waveforms persisted to persistent storage. Raw audio discarded immediately following feature extraction. (Configurable via `siteConfig.retentionPolicy`).

---

## 2. Directory & Route Structure

```
voxproof/
├── public/
│   ├── samples/               # Local test audio samples (bonafide.wav, spoof.mp3)
│   └── fonts/                 # Local font fallbacks if needed
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout: Archivo, Instrument Serif, JetBrains Mono, SmoothScroll, Cursor
│   │   ├── page.tsx           # Marketing Site (Sections 00 - 09)
│   │   ├── analyze/
│   │   │   └── page.tsx       # Pro Analyzer App (States A, B, C with SoundCloud-style hero & transport)
│   │   ├── history/
│   │   │   └── page.tsx       # Analysis History (List/Grid view, filters, search, mini waveforms)
│   │   ├── batch/
│   │   │   └── page.tsx       # Batch Audio Analyzer (Multi-file queue, CSV export, sortable table)
│   │   └── api/               # Next.js API route handlers (Mock & Proxy to FastAPI)
│   │       ├── analyze/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── model-info/route.ts
│   │       └── health/route.ts
│   ├── components/
│   │   ├── common/
│   │   │   ├── CustomCursor.tsx     # Magnetic cursor with label hover states (PLAY, DROP, VIEW)
│   │   │   ├── Barcode.tsx          # Dynamic SVG/Canvas forensic barcode generator
│   │   │   ├── GiantWordmark.tsx    # Split solid/outline VOX / PROOF brand block
│   │   │   ├── SmoothScroll.tsx     # Lenis integration with ScrollTrigger synchronization
│   │   │   └── Marquee.tsx          # Infinite technical attack taxonomy marquee
│   │   ├── layout/
│   │   │   ├── MarketingNav.tsx     # Scroll-direction reactive nav with live backend health pill
│   │   │   ├── MarketingFooter.tsx  # Editorial footer with giant split wordmark
│   │   │   ├── AppShell.tsx         # Pro dense app shell (240px sidebar, top bar, usage meter)
│   │   │   └── AppSidebar.tsx       # Subframe-style dark gray navigation rail
│   │   ├── marketing/
│   │   │   ├── Preloader.tsx        # 000-100 counter with animated drawing waveform and clip wipe
│   │   │   ├── Hero.tsx             # Stacked display headline with floating procedural evidence tiles
│   │   │   ├── EvidenceTile.tsx     # Procedural LFCC & waveform canvas floating cards
│   │   │   ├── ManifestoStrip.tsx   # Scroll-scrubbed waveform morphing organic -> synthetic
│   │   │   ├── InlineDemo.tsx       # Embedded dropzone and instant mini analyzer
│   │   │   ├── HowItWorks.tsx       # Pinned horizontal 5-stage interactive sequence (1 / 5)
│   │   │   ├── AttackTypes.tsx      # Editorial work list with cursor-following spectrogram previews
│   │   │   ├── ModelTransparency.tsx# Paper background (#EEEBE4) model architecture card
│   │   │   └── UseCases.tsx         # 4-card forensic use case grid with tilt motion
│   │   ├── analyzer/
│   │   │   ├── DropzoneEmpty.tsx    # State A: Reactive dashed border, mic recorder, sample triggers
│   │   │   ├── ProcessingStage.tsx  # State B: 5-stage live ticker with scanning laser
│   │   │   ├── ResultView.tsx       # State C: SoundCloud-style results layout
│   │   │   ├── HeroWaveform.tsx     # 280px DPR-aware 2D canvas with colored segment overlays & hatch
│   │   │   ├── TransportBar.tsx     # Docked bottom playback controller with segment navigation
│   │   │   ├── VerdictMeter.tsx     # Horizontal confidence gauge with uncertain band
│   │   │   ├── EvidenceTabs/
│   │   │   │   ├── TimelineCanvas.tsx   # Per-window spoof probability curve with synchronized playhead
│   │   │   │   ├── LfccHeatmap.tsx      # 60-band LFCC Ember colormap canvas with hover inspection
│   │   │   │   ├── SpectrogramCanvas.tsx# 2D FFT spectral energy view
│   │   │   │   ├── SaliencyCanvas.tsx   # Grad-CAM attention heatmap overlay
│   │   │   │   └── RawJsonView.tsx      # Formatted forensic inspection tree
│   │   │   └── RightRail/
│   │   │       ├── SummaryPanel.tsx     # Latency, windows flagged, peak segment score
│   │   │       ├── ModelPanel.tsx       # Active checkpoint parameters and architecture
│   │   │       ├── AttackFamilyPanel.tsx# Top-3 predicted synthesis mechanisms
│   │   │       ├── ExportPanel.tsx      # JSON export, PDF summary generator, shareable link
│   │   │       └── ThresholdSlider.tsx  # Dynamic client-side re-classification threshold slider
│   │   ├── history/
│   │   │   ├── HistoryTable.tsx     # High-density list view with mini waveforms
│   │   │   └── HistoryGrid.tsx      # 20px card grid view
│   │   └── batch/
│   │       └── BatchQueue.tsx       # Multi-file dropzone and sortable queue table
│   ├── config/
│   │   ├── site.ts            # Site constants (BRAND_NAME, navigation links, retention policy)
│   │   └── tokens.ts          # Central design token definitions (colors, fonts, radii, easings)
│   ├── lib/
│   │   ├── api/
│   │   │   ├── types.ts       # Full TypeScript data contracts (ResultShape, AnalysisRequest, etc.)
│   │   │   ├── schema.ts      # Zod validation schemas
│   │   │   ├── client.ts      # Unified API client handling mock and real endpoints
│   │   │   └── mockAdapter.ts # Deterministic mock generator seeded by filename & audio characteristics
│   │   ├── audio/
│   │   │   ├── audioContext.ts# Web Audio API audio decode and buffer handling
│   │   │   └── liveRecorder.ts# MediaRecorder wrapper with realtime FFT visualizer
│   │   └── canvas/
│   │       ├── colormaps.ts   # Ember palette interpolation (0A0A0B -> 3B0F0A -> FF3D2E -> FFD9A0)
│   │       └── renderers.ts   # Waveform, LFCC, and spectrogram Canvas 2D renderers
│   └── store/
│       ├── useAnalyzerStore.ts# Zustand store managing current analysis, playback state, and threshold
│       └── useHistoryStore.ts # Persistent local history and batch queue store
```

---

## 3. Design Tokens Specification

### Colors
```typescript
export const tokens = {
  colors: {
    ink: '#0A0A0B',
    ink2: '#111113',
    ink3: '#1A1A1D',
    line: 'rgba(255, 255, 255, 0.10)',
    paper: '#EEEBE4',
    paperInk: '#111113',
    muted: '#8B8B92',
    bonafide: '#C6FF3D',     // Acid lime
    spoof: '#FF3D2E',        // Signal red
    uncertain: '#FFB020',    // Forensic amber
    waveform: {
      unplayed: '#3A3A40',
      played: '#FFFFFF',
      bonafideHatch: 'rgba(198, 255, 61, 0.35)',
      spoofHatch: 'rgba(255, 61, 46, 0.45)',
    },
    emberHeatmap: [
      { stop: 0.0, color: '#0A0A0B' },
      { stop: 0.33, color: '#3B0F0A' },
      { stop: 0.66, color: '#FF3D2E' },
      { stop: 1.0, color: '#FFD9A0' },
    ]
  },
  typography: {
    display: "'Archivo', sans-serif",
    accent: "'Instrument Serif', serif",
    mono: "'JetBrains Mono', monospace",
    body: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  radii: {
    card: '20px',
    input: '14px',
    pill: '9999px',
  },
  easing: {
    expoOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  }
};
```

---

## 4. API Data Contract

### TypeScript Definitions (`src/lib/api/types.ts`)
```typescript
export type VerdictType = 'bonafide' | 'spoof' | 'uncertain';

export interface ModelMetadata {
  name: string;
  version: string;
  threshold: number;
  uncertain_band: [number, number]; // e.g. [0.42, 0.58]
  sample_rate: number;
  n_lfcc: number;
  frame_length_ms: number;
  hop_length_ms: number;
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
  n_coeff: number;    // 60
  n_frames: number;   // e.g. 398
  hop_ms: number;
  data: number[][];   // [60][n_frames] normalized coefficients
}

export interface AttackFamilyPrediction {
  label: string;      // "Neural TTS", "Voice Conversion", "Vocoder Artifact", etc.
  prob: number;       // 0.0 -> 1.0
}

export interface AnalysisTimings {
  decode: number;     // ms
  features: number;   // ms
  inference: number;  // ms
  total: number;      // ms
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
  score: number;      // Global spoof score [0, 1]
  confidence: number; // Percentage [50%, 100%]
  segments: AudioSegment[];
  waveform_peaks: number[]; // ~1000 downsampled peak amplitudes [-1.0, 1.0]
  lfcc: LfccFeatureMatrix;
  spectrogram?: {
    n_bins: number;
    n_frames: number;
    data: number[][];
  };
  saliency?: number[][];    // Grad-CAM attention matrix matching LFCC
  attack_family?: AttackFamilyPrediction[];
  timings_ms: AnalysisTimings;
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
  status: 'healthy' | 'degraded' | 'offline';
  model_loaded: boolean;
  device: string;
  uptime_seconds: number;
}
```

---

## 5. Execution Phases & Milestones

### Phase 1: Foundation & Scaffolding
- Initialize Next.js 14 App Router project with TypeScript and Tailwind CSS.
- Configure Tailwind tokens, fonts (Archivo, Instrument Serif, JetBrains Mono), and base CSS.
- Implement Lenis smooth scroll provider with ScrollTrigger integration.
- Implement reactive Custom Cursor with interactive magnetic pull and hover states.
- Build typed API client with Zod schemas and deterministic seeded mock engine.
- Verify dev server and capture Phase 1 screenshots at 1440px, 768px, and 390px.

### Phase 2: Editorial Marketing Site (`/`)
- **00 Preloader**: 000-100 counter with animated drawing waveform, clip wipe transition.
- **01 Nav**: Scroll-direction reactive nav with model online indicator.
- **02 Hero**: Stacked display headline (`KNOW / WHO'S / *really* / SPEAKING`), interactive floating evidence tiles with procedural LFCC/waveform rendering, drop audio trigger.
- **03 Manifesto**: Scroll-scrubbed waveform morphing from organic to synthetic with masked text reveals.
- **04 Inline Demo**: Live miniature analyzer dropzone.
- **05 How It Works**: Pinned horizontal 5-stage sequence (1/5) with progress hairline.
- **06 Attack Types**: Bulletproof-style giant work list with cursor-following spectrogram cards and List/Grid toggle.
- **07 Transparency**: Light `#EEEBE4` paper section with live model specifications fetched from `/api/model-info`.
- **08 Use Cases**: 4-card forensic grid with tilt animations.
- **09 Footer & Marquee**: Infinite attack marquee, API access field, and giant split `VOX / PROOF` wordmark.
- Verify dev server and capture Phase 2 screenshots at 1440px, 768px, and 390px.

### Phase 3: Forensic Analyzer App (`/analyze`)
- Construct dark pro-grade app shell (240px sidebar, top bar, usage meter).
- **State A (Empty)**: Reactive dashed dropzone, live microphone PCM recording with audio meter, sample selector.
- **State B (Processing)**: 5-stage sequential ticker with scanning laser line over building LFCC matrix.
- **State C (SoundCloud-grade Result)**:
  - Giant vertical stacked verdict letters (`S/P/O/O/F` or `B/O/N/A/F/I/D/E`) with forensic barcode.
  - 280px DPR-aware Canvas waveform with unplayed gray, played white, and per-segment spoof color + diagonal hatch.
  - Docked bottom transport bar with seek, loop segment, spacebar control.
  - Verdict confidence meter with uncertain band.
  - Synchronized Evidence Tabs: Timeline graph, LFCC Ember heatmap, Spectrogram, Saliency, Raw JSON.
  - Right rail contextual panels with dynamic re-threshold slider.
- Verify dev server and capture Phase 3 screenshots at 1440px, 768px, and 390px.

### Phase 4: History, Batch Processing, & Export (`/history`, `/batch`)
- Build `/history` with List/Grid view toggle, search bar, filter chips (`All`, `Spoof`, `Bonafide`, `Uncertain`), and mini waveform thumbnails.
- Build `/batch` multi-file queue dropzone with batch inference orchestration, sortable columns, and CSV export.
- Implement robust error states (file too large, invalid format, audio too short, model offline fallback).
- Build forensic PDF / JSON report exporter.
- Verify dev server and capture Phase 4 screenshots at 1440px, 768px, and 390px.

### Phase 5: Responsive, Accessibility, Performance & Verification
- Mobile responsiveness audit at 390px: ensure zero typography clipping, responsive right rail bottom sheet, and sticky mini-transport.
- Keyboard navigation (spacebar play, tab focus rings in 2px acid lime, ARIA live region for verdict).
- Prefers-reduced-motion optimizations.
- Final visual audits and capture full breakpoint verification screenshots.
- Complete documentation in `README.md` detailing mock mode toggle and real FastAPI backend integration.
