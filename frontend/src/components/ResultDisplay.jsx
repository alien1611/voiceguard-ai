import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  FileAudio, 
  Clock, 
  Database,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { formatPercent, formatBytes, formatTime } from '../utils/formatters';

export default function ResultDisplay({ result, onReset }) {
  if (!result) return null;

  const isBonafide = result.predicted_class === 'BONAFIDE';
  const confidencePercent = formatPercent(result.confidence);
  const spoofPercent = formatPercent(result.spoof_score);
  const bonafidePercent = formatPercent(result.bonafide_score);
  const meta = result.audio_metadata || {};

  return (
    <div className="space-y-6">
      {/* Primary Classification Verdict Banner */}
      <div
        className={`apple-box p-7 rounded-xl border shadow-card transition-all ${
          isBonafide
            ? 'bg-bonafide-bg border-bonafide-border'
            : 'bg-spoof-bg border-spoof-border'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center space-x-4">
            <div
              className={`w-14 h-14 rounded-full border flex items-center justify-center shrink-0 shadow-soft ${
                isBonafide
                  ? 'bg-bg-surface border-bonafide-border text-bonafide'
                  : 'bg-bg-surface border-spoof-border text-spoof'
              }`}
            >
              {isBonafide ? (
                <ShieldCheck className="w-7 h-7" />
              ) : (
                <ShieldAlert className="w-7 h-7" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-espresso-muted uppercase tracking-wider">
                <span>Verification Verdict</span>
                <span>&bull;</span>
                <span>Cutoff: {result.threshold !== undefined ? result.threshold.toFixed(4) : '0.1590'}</span>
                <span>&bull;</span>
                <span className="font-semibold text-brand-terracotta">{result.source || 'upload'}</span>
              </div>
              <div className="flex items-baseline space-x-3 mt-1">
                <span
                  className={`font-serif text-3xl sm:text-4xl font-bold tracking-tight ${
                    isBonafide ? 'text-bonafide' : 'text-spoof'
                  }`}
                >
                  {result.predicted_class}
                </span>
                <span className="text-xs text-espresso-secondary">
                  ({isBonafide ? 'Authentic Human Speech' : 'Synthetic or Converted Voice'})
                </span>
              </div>
            </div>
          </div>

          {/* Confidence Badge */}
          <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-border-subtle pt-3 sm:pt-0 sm:pl-7 shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-espresso-muted font-semibold">
              Confidence Rating
            </div>
            <div
              className={`text-4xl font-mono font-bold ${
                isBonafide ? 'text-bonafide' : 'text-spoof'
              }`}
            >
              {confidencePercent}
            </div>
          </div>
        </div>
      </div>

      {/* Model Probability Breakdown & Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Probability Breakdown */}
        <div className="md:col-span-7 bg-bg-surface border border-border-subtle rounded-xl p-6 space-y-4 shadow-card">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="text-xs font-mono font-semibold text-espresso uppercase tracking-wider">
              Acoustic Probability Breakdown
            </span>
            <span className="text-[11px] text-espresso-muted font-mono">
              Sigmoid Scaled
            </span>
          </div>

          <div className="space-y-4">
            {/* Bonafide Score */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-espresso-secondary">Human Speech Probability</span>
                <span className="font-semibold text-bonafide">{bonafidePercent}</span>
              </div>
              <div className="w-full h-2.5 bg-bg-secondary rounded-full overflow-hidden border border-border-subtle">
                <div
                  className="h-full bg-bonafide rounded-full transition-all duration-300"
                  style={{ width: `${(result.bonafide_score || 0) * 100}%` }}
                />
              </div>
            </div>

            {/* Spoof Score */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-espresso-secondary">Synthetic Spoof Probability</span>
                <span className="font-semibold text-spoof">{spoofPercent}</span>
              </div>
              <div className="w-full h-2.5 bg-bg-secondary rounded-full overflow-hidden border border-border-subtle">
                <div
                  className="h-full bg-spoof rounded-full transition-all duration-300"
                  style={{ width: `${(result.spoof_score || 0) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-espresso-secondary pt-1 leading-relaxed">
            Evaluated against the speaker-weighted decision threshold of 0.1590 (raw logit). Scores above this boundary exhibit spectral frame phase anomalies characteristic of neural vocoder synthesis.
          </p>
        </div>

        {/* Audio File Metadata */}
        <div className="md:col-span-5 bg-bg-surface border border-border-subtle rounded-xl p-6 space-y-3.5 font-mono text-xs shadow-card">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="font-semibold text-espresso uppercase tracking-wider">
              Acoustic Telemetry
            </span>
            <FileAudio className="w-4 h-4 text-brand-primary" />
          </div>

          <div className="space-y-2.5 text-[11px]">
            <div className="flex justify-between text-espresso-secondary">
              <span>Input Ingestion:</span>
              <span className="text-espresso font-semibold uppercase">
                {result.source || 'upload'}
              </span>
            </div>

            <div className="flex justify-between text-espresso-secondary">
              <span>Audio Duration:</span>
              <span className="text-espresso">
                {meta.duration_seconds ? `${meta.duration_seconds.toFixed(2)}s` : '4.00s'}
              </span>
            </div>

            <div className="flex justify-between text-espresso-secondary">
              <span>Native Rate:</span>
              <span className="text-espresso">
                {meta.original_sample_rate ? `${meta.original_sample_rate} Hz` : '16,000 Hz'}
              </span>
            </div>

            <div className="flex justify-between text-espresso-secondary">
              <span>Extraction Filterbank:</span>
              <span className="text-espresso">60-Band LFCC (512 FFT)</span>
            </div>

            <div className="flex justify-between text-espresso-secondary">
              <span>Inference Engine:</span>
              <span className="text-espresso font-semibold">AudioCNN (23.4k)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-espresso-secondary font-mono">
          Audit ID: <span className="text-espresso font-mono">{result.detection_id || 'LOCAL-RAM'}</span>
        </span>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center space-x-2 px-6 py-2.5 bg-bg-surface hover:bg-bg-secondary border border-border-subtle text-xs font-semibold text-espresso rounded-md transition-all shadow-soft"
        >
          <RotateCcw className="w-3.5 h-3.5 text-brand-primary" />
          <span>Verify Another Recording</span>
        </button>
      </div>
    </div>
  );
}
