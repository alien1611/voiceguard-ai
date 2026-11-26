import React, { useEffect } from 'react';
import { X, Cpu, Layers, ShieldCheck, HardDrive, Key, Fingerprint } from 'lucide-react';

export default function ModelInfoModal({ isOpen, onClose, modelInfo }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 glassy-modal-backdrop select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="white-glass-card w-full max-w-xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle/60 bg-white/80 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <Cpu className="w-4 h-4 text-brand-primary" />
            <h2 className="font-serif font-bold text-base text-espresso">Authoritative Model Specifications</h2>
          </div>
          <button
            onClick={onClose}
            className="text-espresso-secondary hover:text-espresso p-1.5 rounded-md hover:bg-white/60 transition-colors"
            aria-label="Close specifications modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto font-mono text-xs bg-white/30">
          {modelInfo ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-xl bg-white/95 border border-border-subtle/80 space-y-1 shadow-soft hover:border-brand-terracotta/40 transition-colors">
                <span className="text-[10px] uppercase font-bold tracking-wider text-espresso-muted">Active Checkpoint</span>
                <p className="text-xs font-bold text-espresso">AudioCNN (Speaker-Weighted)</p>
                <p className="text-[10px] text-espresso-secondary">best_audio_cnn_itw_speaker_weighted.pth</p>
              </div>

              <div className="p-4 rounded-xl bg-white/95 border border-border-subtle/80 space-y-1 shadow-soft hover:border-brand-terracotta/40 transition-colors">
                <span className="text-[10px] uppercase font-bold tracking-wider text-espresso-muted">Weights &amp; Device</span>
                <p className="text-xs font-bold text-espresso">23,361 Trainable Parameters</p>
                <p className="text-[10px] text-bonafide uppercase font-bold">{modelInfo.device || 'CPU Inference'}</p>
              </div>

              <div className="p-4 rounded-xl bg-white/95 border border-border-subtle/80 space-y-1 shadow-soft hover:border-brand-terracotta/40 transition-colors">
                <span className="text-[10px] uppercase font-bold tracking-wider text-espresso-muted">Feature Extractor</span>
                <p className="text-xs font-bold text-espresso">60-Band LFCC (SciPy DCT-II)</p>
                <p className="text-[10px] text-espresso-secondary">400 win &bull; 160 hop &bull; 512 FFT</p>
              </div>

              <div className="p-4 rounded-xl bg-white/95 border border-border-subtle/80 space-y-1 shadow-soft hover:border-brand-terracotta/40 transition-colors">
                <span className="text-[10px] uppercase font-bold tracking-wider text-espresso-muted">Temporal Aperture</span>
                <p className="text-xs font-bold text-espresso">
                  16,000 Hz &bull; 4.00s
                </p>
                <p className="text-[10px] text-espresso-secondary">64,000 Linear PCM Samples</p>
              </div>

              <div className="p-4 rounded-xl bg-white/95 border border-border-subtle/80 space-y-1.5 shadow-soft sm:col-span-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-espresso-muted">Input Tensor Geometry</span>
                <p className="text-xs font-bold text-espresso">
                  [{modelInfo.input_shape?.join(', ') || '1, 1, 60, 398'}]
                </p>
                <p className="text-[10px] text-espresso-secondary">Batch &times; Channel &times; Filterbank &times; Frames</p>
              </div>

              <div className="p-4 rounded-xl bg-white/95 border border-border-subtle/80 space-y-1.5 shadow-soft sm:col-span-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-espresso-muted">Calibrated Decision Cutoff</span>
                <p className="text-xs font-bold text-espresso">
                  Threshold: 0.15903853
                </p>
                <p className="text-[10px] text-espresso-secondary">
                  Raw Logit &ge; 0.1590 &rarr; <span className="text-spoof font-bold">SPOOF</span> &bull; &lt; 0.1590 &rarr; <span className="text-bonafide font-bold">BONAFIDE</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/95 border border-border-subtle/80 space-y-2 shadow-soft sm:col-span-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-espresso-muted">Artifact Cryptographic Hashes</span>
                <div className="space-y-1.5 text-[10px]">
                  <div className="p-2 bg-bg-secondary/40 rounded border border-border-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-espresso">Model SHA-256</span>
                    <span className="font-mono text-espresso-secondary select-all">12c4605dce7cad193c4cb22c8b4543a0e5268a7212fe5fbf35dc20a23c0ba2cf</span>
                  </div>
                  <div className="p-2 bg-bg-secondary/40 rounded border border-border-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-espresso">Stats SHA-256</span>
                    <span className="font-mono text-espresso-secondary select-all">39c95865809ac6b4cc72dd2fb4264a866bbecbd070e2356f28f34825acf39182</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-espresso-secondary">
              Retrieving laboratory specifications...
            </div>
          )}

          {/* Privacy Guarantee */}
          <div className="p-4 rounded-xl bg-bonafide-bg/95 border border-bonafide-border flex items-start space-x-3 text-[11px] font-sans shadow-soft">
            <ShieldCheck className="w-5 h-5 text-bonafide shrink-0 mt-0.5" />
            <div className="text-espresso leading-relaxed">
              <span className="font-semibold text-bonafide">Zero-Persistence Acoustic Pipeline: </span>
              Microphone waveforms and uploaded audio samples are decoded and analyzed exclusively in volatile system RAM. Raw audio data is discarded immediately after forward-pass inference.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle/60 bg-white/80 backdrop-blur-md flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-brand-primary hover:bg-brand-deep text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft"
          >
            Close Specifications
          </button>
        </div>
      </div>
    </div>
  );
}
