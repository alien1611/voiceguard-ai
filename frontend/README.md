# VoiceGuard AI – Frontend Application

VoiceGuard AI is an academic AI voice spoof detection dashboard built with **React**, **Vite**, and **Tailwind CSS**, integrated locally with our Python FastAPI backend, PyTorch `AudioCNN` model, and local MongoDB Community database.

---

## 1. Key Features

- **Dashboard:** System metrics, real-time backend health check, model specs modal, and 5-stage acoustic pipeline diagram.
- **Audio File Upload:** Drag-and-drop or file browser supporting `.wav`, `.flac`, `.mp3`, and `.ogg` files up to 25 MB.
- **In-Browser Microphone Recording:**
  - Real-time PCM audio capture using the Web Audio API (`AudioContext`, `ScriptProcessorNode`, `AnalyserNode`).
  - Native client-side 16-bit PCM mono 16 kHz WAV encoding using custom `wavEncoder.js` (avoids WebM/M4A browser incompatibility).
  - Live audio gain meter, duration timer, playback preview, retake, and submission.
- **Detection Results Display:**
  - Clear `BONAFIDE` (Human) vs. `SPOOF` (AI / Synthetic) classification banner.
  - Confidence percentage, dual probability distribution bars, inference latency, standardized audio metadata, and MongoDB saved status badge.
  - Academic disclaimer regarding prototype calibration and real-world acoustic domain shifts.
- **Detection History Dashboard (Phase 4):**
  - Persistent local history powered by local MongoDB (`voiceguard_db.detection_history`).
  - Summary metric cards: Total Detections, Human (Bonafide) count, AI Deepfake (Spoof) count, and MongoDB status indicator with live ping latency.
  - Interactive class filtering: `All`, `Bonafide`, `Spoof`.
  - Paginated table: classification badge, filename, duration, confidence %, spoof score, inference latency, and formatted timestamp.
  - Record Details modal: complete acoustic metadata, SHA-256 audio hash, 60 LFCC filter parameters, and AudioCNN architecture specs.
  - Delete single record with instant table update.
  - "Clear History" confirmation dialog to safely purge records.
  - Empty state with CTA to jump directly into voice analysis.
  - Graceful degradation: displays informative warning banner if MongoDB daemon is offline while preserving core classification functionality.
- **100% Local Execution:** Zero cloud egress, zero third-party APIs, transient RAM-only processing.

---

## 2. Directory Structure

```
frontend/
├── index.html                   # HTML entry point with dark cyber styling & fonts
├── package.json                 # React 18, Vite 6, Tailwind CSS, Lucide icons
├── vite.config.js               # Vite configuration (port 5173, host 127.0.0.1)
├── tailwind.config.js           # Cyber navy theme color palette and typography
├── postcss.config.js            # PostCSS configuration
├── src/
│   ├── main.jsx                 # Application entry point
│   ├── App.jsx                  # Main application container, tab routing, & health polling
│   ├── index.css                # Tailwind directives and custom animation styles
│   ├── components/
│   │   ├── Navbar.jsx           # Top navigation, brand, backend & MongoDB status pills
│   │   ├── Dashboard.jsx        # Hero section, quick start CTA, and pipeline diagram
│   │   ├── Detector.jsx         # Upload vs Microphone tab container
│   │   ├── FileUploader.jsx     # Drag & drop upload, duration detection, audio preview
│   │   ├── MicrophoneRecorder.jsx # Web Audio API recorder, PCM capture, level visualizer
│   │   ├── ResultDisplay.jsx    # Classification verdict, probability bars, metadata, DB saved tag
│   │   ├── HistoryView.jsx      # Phase 4 Detection History, summary cards, table, & modal
│   │   ├── AboutSection.jsx     # Detailed architectural whitepaper and privacy guarantees
│   │   └── ModelInfoModal.jsx   # Live specs fetched from /api/model-info
│   ├── services/
│   │   └── api.js               # Client for predict, health, model-info, and MongoDB CRUD
│   └── utils/
│       ├── wavEncoder.js        # Web Audio API PCM float32 to 16-bit mono 16 kHz WAV encoder
│       └── formatters.js        # Byte sizes, time, and percentage formatting helpers
└── scripts/
    ├── test_integration.mjs     # Phase 3 integration test suite
    ├── test_phase4_integration.mjs # Phase 4 API & MongoDB integration test suite
    ├── test_phase4_browser.mjs  # Phase 4 real Chrome CDP automated audit suite
    └── test_real_browser.mjs    # Phase 3 real Chrome CDP microphone audit
```

---

## 3. Quickstart Guide

### Step 1: Start Local MongoDB Server
Ensure the local MongoDB Community daemon is active on port 27017:
```powershell
mongod --dbpath <data_directory> --port 27017 --bind_ip 127.0.0.1
```

### Step 2: Start the Local Backend Server
```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Backend is live at: `http://127.0.0.1:8000`

### Step 3: Start the Frontend Application
```powershell
cd frontend
npm run dev
```
Or for production build and preview:
```powershell
npm run build
npm run preview -- --port 5173 --host 127.0.0.1
```
Frontend is live at: `http://127.0.0.1:5173`

---

## 4. Running Verification Test Suites

```powershell
# 1. Run Phase 4 API and MongoDB integration tests (9 tests)
node frontend/scripts/test_phase4_integration.mjs

# 2. Run Phase 4 real browser (Chrome CDP) automated audit (8 tests)
node frontend/scripts/test_phase4_browser.mjs
```
