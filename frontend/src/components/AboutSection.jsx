import React from 'react';
import { 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Lock, 
  FileCode, 
  Sliders, 
  Activity, 
  Database,
  AlertTriangle
} from 'lucide-react';

export default function AboutSection() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6">
      {/* Title */}
      <div className="space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          <span>Technical Whitepaper &amp; System Architecture</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          About VoiceGuard AI
        </h1>
        <p className="text-slate-300 text-sm leading-relaxed">
          VoiceGuard AI is an academic machine learning pipeline designed to distinguish authentic biological 
          human speech from synthetic, vocoded, or cloned speech. The entire feature extraction and neural inference 
          lifecycle executes strictly on your local hardware.
        </p>
      </div>

      {/* 5-Stage Architecture Deep Dive */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
          <span>End-to-End Processing Architecture</span>
        </h2>

        <div className="space-y-4">
          {/* Stage 1 */}
          <div className="p-5 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-base font-semibold text-white">Audio Ingestion &amp; Conditioning</h3>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                16 kHz Mono • 64k Samples
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-9">
              Uploaded or recorded audio streams are read in-memory. Multi-channel signals (stereo) are averaged into mono. 
              The signal is resampled to exactly 16,000 Hz and conditioned to a fixed 4.0-second window (64,000 samples). 
              Signals shorter than 4.0s are padded symmetrically with silence, while longer signals are cropped from center.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-5 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-base font-semibold text-white">Harmonized 60-Band LFCC Feature Extraction</h3>
              </div>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                Matrix Shape: (60, 398)
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-9">
              Unlike Mel-scale filterbanks (MFCC) which compress high frequencies to mimic human psychoacoustics, 
              <strong> Linear Frequency Cepstral Coefficients (LFCC)</strong> use linearly spaced triangular filters 
              across the full Nyquist spectrum (0 to 8,000 Hz). This preserves critical high-frequency synthetic artifacts, 
              phase discontinuity, and vocoder spectral tilt. The extraction applies a symmetric Hamming window (400 samples, 25 ms), 
              a hop of 160 samples (10 ms), a 512-point FFT with right-side zero-padding, log energy with &epsilon; = 10<sup>-10</sup>, 
              and DCT-II orthogonal projection.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-5 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-base font-semibold text-white">Z-Score Normalization</h3>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                &mu;, &sigma; Vectors: (60, 1)
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-9">
              Extracted LFCC coefficients are standardized against the baseline training distribution: 
              <code className="text-cyan-300 font-mono text-[11px] bg-slate-800 px-1 py-0.5 rounded mx-1">
                x_norm = (x - mean) / (std + 1e-8)
              </code>. 
              The precalculated mean and standard deviation vectors were derived from the ASVspoof 2019 logical access 
              training partition and are stored in <code className="text-cyan-300 font-mono text-[11px] bg-slate-800 px-1 py-0.5 rounded">cnn/normalized_train.npz</code>.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="p-5 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <h3 className="text-base font-semibold text-white">AudioCNN Neural Classification</h3>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                PyTorch • 24,305 Weights
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-9">
              The normalized 2D acoustic map is evaluated by a lightweight 3-block convolutional neural network (<code className="text-cyan-300 font-mono">AudioCNN</code>). 
              Each block integrates 2D convolution, Batch Normalization, ReLU activation, 2x2 Max Pooling, and Dropout. 
              The final feature map is flattened into a 128-unit dense layer, passing into a single scalar output logit.
            </p>
          </div>

          {/* Stage 5 */}
          <div className="p-5 rounded-xl bg-navy-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center">
                  5
                </span>
                <h3 className="text-base font-semibold text-white">Decision Thresholding &amp; Scoring</h3>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                Threshold: 0.50
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-9">
              A logistic sigmoid function transforms the scalar logit into a spoof probability score &isin; [0.0, 1.0]. 
              If <code className="text-rose-400 font-mono text-[11px] bg-slate-800 px-1 py-0.5 rounded">spoof_score &ge; 0.50</code>, 
              the recording is classified as <strong className="text-rose-400">SPOOF</strong>. Otherwise, it is designated as <strong className="text-teal-400">BONAFIDE</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Local Privacy Commitment */}
      <div className="p-6 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-3">
        <div className="flex items-center space-x-2 text-teal-400">
          <Lock className="w-5 h-5" />
          <h3 className="font-bold text-base text-white">Zero Cloud Egress &amp; Local Privacy</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          All audio payloads submitted to VoiceGuard AI remain strictly inside your computer's local memory (`RAM`). 
          Audio buffers are decoded in transient memory, converted into numerical tensors, and discarded immediately after prediction. 
          No audio files are written to disk, stored in databases, or transmitted over the internet.
        </p>
      </div>

      {/* Realistic Technical Scope & Academic Limitations */}
      <div className="p-6 rounded-2xl bg-navy-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center space-x-2 text-amber-400">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-bold text-base text-white">Academic Scope &amp; Real-World Limitations</h3>
        </div>
        <div className="text-xs text-slate-300 leading-relaxed space-y-2">
          <p>
            • <strong>No Universal Deepfake Guarantee:</strong> VoiceGuard is an academic classifier trained on the ASVspoof benchmark. 
            It is not guaranteed to detect every modern voice-cloning algorithm, diffusion vocoder, or adversarial neural attack.
          </p>
          <p>
            • <strong>Acoustic Domain Shift:</strong> Audio recorded with uncalibrated consumer microphones, background ambient noise, 
            or extreme reverberation exhibits acoustic properties different from telecommunication datasets and may induce false-positive spoof predictions.
          </p>
          <p>
            • <strong>Uncalibrated Sigmoid Scores:</strong> The confidence score is a sigmoid representation of model distance from the decision boundary, 
            not a calibrated Bayesian probability.
          </p>
        </div>
      </div>
    </div>
  );
}
