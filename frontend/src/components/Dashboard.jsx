import React, { useState, useEffect } from 'react';
import { 
  FileAudio, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Activity,
  Layers,
  Clock,
  Mic,
  Radio,
  FileCheck2,
  Sparkles,
  Waves,
  ShieldCheck,
  Cpu,
  Fingerprint,
  ChevronRight
} from 'lucide-react';
import { getDetectionHistory } from '../services/api';
import { formatPercent } from '../utils/formatters';

export default function Dashboard({ 
  onStartDetection, 
  onStartRecord,
  onStartLive,
  backendHealth, 
  modelInfo,
  onOpenModelInfo 
}) {
  const [stats, setStats] = useState({
    total: 0,
    bonafide: 0,
    spoof: 0,
    hasData: false,
  });
  const [recentItems, setRecentItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadOverviewData() {
      setIsLoading(true);
      try {
        const history = await getDetectionHistory(1, 5);
        if (isMounted) {
          if (history?.summary) {
            setStats({
              total: history.summary.total_detections || 0,
              bonafide: history.summary.bonafide_count || 0,
              spoof: history.summary.spoof_count || 0,
              hasData: true,
            });
          }
          if (history?.items) {
            setRecentItems(history.items);
          }
        }
      } catch {
        // Graceful fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadOverviewData();
    return () => {
      isMounted = false;
    };
  }, []);

  const isHealthy = backendHealth?.status === 'healthy';

  return (
    <div className="space-y-10 max-w-6xl">
      {/* Editorial Hero Section with Bespoke Acoustic Visual */}
      <div className="bg-bg-surface rounded-xl border border-border-subtle p-8 sm:p-10 shadow-card relative overflow-hidden">
        {/* Subtle background ambient pattern */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-caramel-subtle/50 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Left Column: Editorial Headline & Copy */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-primary-subtle text-brand-primary border border-brand-primary/20 text-[11px] font-mono uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-terracotta" />
              <span>Acoustic Security Lab &bull; Model v2.0</span>
            </div>

            <h2 className="editorial-display text-3xl sm:text-4xl lg:text-5xl font-bold text-espresso tracking-tight leading-[1.15]">
              Acoustic Integrity &amp; Neural Voice Verification
            </h2>

            <p className="text-sm sm:text-base text-espresso-secondary leading-relaxed max-w-xl">
              VoiceGuard dissects high-resolution vocal tracts through 60-band Linear Frequency Cepstral Coefficients (LFCC) and a fine-tuned speaker-weighted Convolutional Neural Network, isolating micro-acoustic artifacts in synthetic speech and neural vocoder clones.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStartDetection}
                className="inline-flex items-center space-x-2.5 px-6 py-3 bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface text-xs font-semibold uppercase tracking-wider rounded-md transition-all shadow-soft"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Verify Audio File</span>
              </button>

              <button
                type="button"
                onClick={onStartLive}
                className="inline-flex items-center space-x-2 px-5 py-3 bg-bg-surface hover:bg-bg-secondary text-espresso border border-border-subtle text-xs font-semibold rounded-md transition-all shadow-soft"
              >
                <Radio className="w-4 h-4 text-brand-terracotta" />
                <span>Continuous Stream</span>
              </button>
            </div>
          </div>

          {/* Right Column: Custom Micro-Acoustic Spectral Lattice Visual (SVG/CSS) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="apple-box w-full max-w-xs p-6 bg-bg-secondary/40 border border-border-subtle rounded-xl shadow-soft space-y-3 cursor-default">
              <div className="flex items-center justify-between text-[10px] font-mono text-espresso-secondary uppercase tracking-wider">
                <span>Spectral Decomposition</span>
                <span>60 &times; 398 Tensors</span>
              </div>

              {/* Bespoke Geometric Frequency Visualization */}
              <div className="h-44 w-full bg-bg-surface rounded-lg border border-border-subtle p-3 flex flex-col justify-between relative overflow-hidden">
                {/* Horizontal frequency gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-20 pointer-events-none">
                  <div className="w-full h-px bg-espresso" />
                  <div className="w-full h-px bg-espresso" />
                  <div className="w-full h-px bg-espresso" />
                  <div className="w-full h-px bg-espresso" />
                </div>

                {/* Spectral frequency columns */}
                <div className="flex items-end justify-between h-32 gap-1 relative z-10">
                  {[42, 68, 85, 30, 95, 62, 78, 45, 88, 55, 72, 38, 91, 64, 48, 80, 58, 74].map((val, idx) => (
                    <div
                      key={idx}
                      className="flex-1 rounded-t-sm transition-all duration-300"
                      style={{
                        height: `${val}%`,
                        backgroundColor:
                          idx % 3 === 0
                            ? '#C87555' // terracotta
                            : idx % 3 === 1
                            ? '#BD9068' // caramel
                            : '#75513D', // primary brown
                        opacity: 0.85 + (idx % 3) * 0.05,
                      }}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-espresso-muted pt-1 border-t border-border-subtle">
                  <span>0 Hz (Fundamental)</span>
                  <span>8,000 Hz (Nyquist)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-espresso-secondary">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-bonafide" />
                  <span>Calibrated Cutoff</span>
                </span>
                <span className="font-bold text-espresso">0.1590 logit</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Three Differentiated Gateway Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Gateway 1: Verify Audio File */}
        <div 
          onClick={onStartDetection}
          className="apple-box group bg-bg-surface p-6 rounded-xl border border-border-subtle shadow-card hover:border-brand-terracotta/60 cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-brand-terracotta-subtle border border-brand-terracotta/20 flex items-center justify-center text-brand-terracotta group-hover:scale-105 transition-transform shadow-soft">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-espresso group-hover:text-brand-terracotta transition-colors">
                Verify Audio File
              </h3>
              <p className="text-xs text-espresso-secondary mt-1 leading-relaxed">
                Inspect prerecorded audio files in lossless memory. Supports WAV, MP3, FLAC, and OGG containers.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-semibold text-brand-terracotta">
            <span>Launch File Verifier</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Gateway 2: Studio Microphone Capture */}
        <div 
          onClick={onStartRecord}
          className="apple-box group bg-bg-surface p-6 rounded-xl border border-border-subtle shadow-card hover:border-brand-primary/60 cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-brand-primary-subtle border border-brand-primary/20 flex items-center justify-center text-brand-primary group-hover:scale-105 transition-transform shadow-soft">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-espresso group-hover:text-brand-primary transition-colors">
                Studio Voice Capture
              </h3>
              <p className="text-xs text-espresso-secondary mt-1 leading-relaxed">
                Direct in-browser microphone capture with reactive real-time bouncing waveform analysis.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-semibold text-brand-primary">
            <span>Record Voice</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Gateway 3: Continuous Live Stream */}
        <div 
          onClick={onStartLive}
          className="apple-box group bg-bg-surface p-6 rounded-xl border border-border-subtle shadow-card hover:border-brand-caramel/60 cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-brand-caramel-subtle border border-brand-caramel/20 flex items-center justify-center text-brand-caramel group-hover:scale-105 transition-transform shadow-soft">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-espresso group-hover:text-brand-caramel transition-colors">
                Continuous Live Stream
              </h3>
              <p className="text-xs text-espresso-secondary mt-1 leading-relaxed">
                Real-time 4-second sliding windows with energy-based VAD silence gating and temporal EMA smoothing.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-semibold text-brand-caramel">
            <span>Open Live Monitor</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Understated Acoustic Telemetry Strip (No giant 4-card metric blocks) */}
      <div className="bg-bg-surface rounded-xl border border-border-subtle p-5 shadow-soft">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
          <div className="pt-2 md:pt-0 md:px-4 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-espresso-muted">
              Verification Audits
            </span>
            <div className="text-2xl font-mono font-bold text-espresso">
              {stats.total.toLocaleString()}
            </div>
            <p className="text-[11px] text-espresso-secondary font-mono">Logged records</p>
          </div>

          <div className="pt-2 md:pt-0 md:px-4 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-espresso-muted">
              Authentic Speech
            </span>
            <div className="text-2xl font-mono font-bold text-bonafide flex items-center space-x-2">
              <span>{stats.bonafide.toLocaleString()}</span>
              <span className="w-2 h-2 rounded-full bg-bonafide" />
            </div>
            <p className="text-[11px] text-espresso-secondary font-mono">Verified human</p>
          </div>

          <div className="pt-2 md:pt-0 md:px-4 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-espresso-muted">
              Synthetic Clones
            </span>
            <div className="text-2xl font-mono font-bold text-spoof flex items-center space-x-2">
              <span>{stats.spoof.toLocaleString()}</span>
              <span className="w-2 h-2 rounded-full bg-spoof" />
            </div>
            <p className="text-[11px] text-espresso-secondary font-mono">Flagged deepfakes</p>
          </div>

          <div className="pt-2 md:pt-0 md:px-4 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-espresso-muted">
              Model Checkpoint
            </span>
            <div className="text-sm font-semibold text-espresso pt-1 truncate">
              AudioCNN (23.4k)
            </div>
            <p className="text-[11px] text-espresso-muted font-mono truncate">
              Cutoff: 0.1590 logit
            </p>
          </div>
        </div>
      </div>

      {/* Recent Verification Activity Archive */}
      <div className="bg-bg-surface rounded-xl border border-border-subtle shadow-card overflow-hidden">
        <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-bg-surface">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-4 h-4 text-brand-primary" />
            <h3 className="font-serif font-bold text-base text-espresso">
              Recent Verifications
            </h3>
          </div>
          <span className="text-xs text-espresso-secondary font-mono">
            {recentItems.length > 0 ? `Showing ${recentItems.length} records` : 'No verifications yet'}
          </span>
        </div>

        {recentItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-bg-secondary/50 text-espresso-secondary uppercase text-[10px] tracking-wider border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-5 font-medium">Audio Source</th>
                  <th className="py-3 px-5 font-medium">Channel</th>
                  <th className="py-3 px-5 font-medium">Classification</th>
                  <th className="py-3 px-5 font-medium">Confidence</th>
                  <th className="py-3 px-5 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {recentItems.map((item, idx) => {
                  const isBona = item.predicted_class === 'BONAFIDE';
                  const itemSource = (item.source || 'upload').toLowerCase();
                  const dateStr = item.created_at
                    ? new Date(item.created_at).toLocaleString()
                    : item.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : 'Recent';

                  return (
                    <tr key={item.detection_id || item.id || idx} className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="py-3.5 px-5 text-espresso font-medium truncate max-w-xs">
                        <div className="flex items-center space-x-2.5">
                          <FileAudio className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{item.filename || 'Audio Stream'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] uppercase font-mono bg-bg-secondary text-espresso-secondary border border-border-subtle">
                          {itemSource}
                        </span>
                      </td>

                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                            isBona
                              ? 'bg-bonafide-bg text-bonafide border border-bonafide-border'
                              : 'bg-spoof-bg text-spoof border border-spoof-border'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isBona ? 'bg-bonafide' : 'bg-spoof'}`} />
                          <span>{item.predicted_class}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-espresso font-semibold">
                        {formatPercent(item.confidence)}
                      </td>

                      <td className="py-3.5 px-5 text-espresso-secondary text-[11px]">
                        {dateStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-bg-secondary border border-border-subtle flex items-center justify-center text-espresso-muted mx-auto">
              <FileAudio className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-serif font-bold text-base text-espresso">No Verification Records</p>
              <p className="text-xs text-espresso-secondary max-w-sm mx-auto">
                Verified audio files and real-time streams will appear in this audit trail automatically.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onStartDetection}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft"
              >
                <span>Verify First Audio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
