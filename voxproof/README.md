# VOXPROOF – AI Voice-Authenticity Detector

**VOXPROOF** is an editorial-grade, forensic AI voice-authenticity detection platform. It couples an Awwwards-caliber marketing showcase with a dense, dark, pro-grade studio app.

Audio recordings (WAV, MP3, FLAC, OGG, M4A) are analyzed using a 3-block convolutional neural network (`AudioCNN`, 24,305 parameters) trained on 60-band Linear Frequency Cepstral Coefficients (LFCC) over a fixed 4.0-second aperture (64,000 samples at 16,000 Hz). The system classifies speech into **BONAFIDE** (genuine human speech) or **SPOOF** (neural TTS, voice conversion, cloned or replayed speech) with frame-level explainability.

---

## 1. Quickstart

### Development Server
```bash
# Navigate to the voxproof project directory
cd voxproof

# Install dependencies (if not already installed)
npm install

# Start Next.js development server on port 3000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Mock Mode vs. Real AudioCNN Backend

VOXPROOF includes a typed API client and a deterministic mock engine seeded by filename, enabling comprehensive end-to-end testing with realistic speech envelopes, LFCC filterbanks, and Grad-CAM saliency without local GPU/PyTorch requirements.

### Using the Deterministic Mock Engine (Default)
In `voxproof/.env.local` (or standard environment variables):
```env
NEXT_PUBLIC_USE_MOCK=true
```
When enabled:
- Filenames containing `bonafide`, `human`, or `real` deterministically yield authentic human classification (e.g., spoof probability 0.05 – 0.23).
- Filenames containing `spoof`, `fake`, `tts`, or `clone` yield high-risk synthetic classification (e.g., spoof probability 0.78 – 0.97).
- Microphones and benchmark sample buttons generate reproducible 60-band LFCC heatmaps, synchronized playback waves, and Grad-CAM attention weights.

### Connecting to the Live Python LFCC + AudioCNN Backend
1. Start the local FastAPI backend server from the workspace root:
```powershell
# From project root
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
2. In `voxproof/.env.local`, set:
```env
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```
3. Restart the Next.js dev server:
```bash
npm run dev
```
VOXPROOF will stream audio directly to the local FastAPI backend, which extracts 60-band LFCC coefficients with PyTorch, runs inference through `best_audio_cnn_22k.pth`, and persists telemetry to local MongoDB.

---

## 3. Architecture & Routing

| Route | Interface | Description |
| :--- | :--- | :--- |
| `/` | **Marketing Showcase** | 10 editorial sections (00 Preloader through 09 CTA/Footer) featuring giant typography, procedural floating evidence tiles, scroll-scrubbed waveform manifesto, interactive methodology sequence (1/5), threat taxonomy with List/Grid toggle, and transparency card. |
| `/analyze` | **Pro Forensic Studio** | SoundCloud-inspired analyzer featuring 280px DPR Canvas waveform, docked transport bar, 5 evidence tabs (Probability Timeline, LFCC Ember Heatmap, Spectrogram, Grad-CAM Saliency, Raw JSON), and right rail panels with real-time re-thresholding. |
| `/history` | **Telemetry Vault** | List and Grid view toggle, search bar, verdict filter chips (`All`, `Spoof`, `Bonafide`, `Uncertain`), mini waveform thumbnails, and single/purge deletion. |
| `/batch` | **Batch Dispatcher** | Multi-file queue dropzone, concurrent execution, sortable columns, and CSV export. |
| `/api/*` | **API Route Handlers** | Next.js API handlers for `/api/health`, `/api/model-info`, and `/api/analyze`. |

---

## 4. Design Tokens & Styling

- **Working Name Constant:** `VOXPROOF` (configured in `src/config/site.ts`).
- **Canvas Palette:**
  - Ink Canvas: `#0A0A0B`, `#111113`, `#1A1A1D`
  - Bonafide / Accent: `#C6FF3D` (Acid Lime)
  - Spoof: `#FF3D2E` (Forensic Red)
  - Uncertain Band: `#FFB020` (Forensic Amber)
  - Paper: `#EEEBE4` (Light Transparency section)
  - LFCC Ember Colormap: `#0A0A0B` → `#3B0F0A` → `#FF3D2E` → `#FFD9A0`
- **Typography:**
  - Display: `Archivo` (800 / 900 weight, -0.045em tracking)
  - Accent: `Instrument Serif` (Italic, used for ONE word per headline)
  - Mono / Labels: `JetBrains Mono` (11px uppercase, 0.08em tracking)
- **Acoustic Waveforms:** Handcrafted 2D Canvas renderers (`devicePixelRatio` scaled) with unplayed `#3A3A40`, played `#FFFFFF`, per-segment probability washes, and diagonal hatching on spoof segments.

---

## 5. Verification Screenshots

All phases have been verified across breakpoints:
- Desktop: `1440 x 900`
- Tablet: `768 x 1024`
- Mobile: `390 x 844`

Generated screenshots are stored in `voxproof/screenshots/`.
