import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, 
  Square, 
  Pause, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileAudio,
  Volume2,
  Clock,
  Sparkles,
  ShieldAlert,
  Radio,
  Disc
} from 'lucide-react';
import WaveformPlayer from './WaveformPlayer';
import ResultDisplay from './ResultDisplay';
import { encodeWav } from '../utils/wavEncoder';
import { extractWaveformPeaks } from '../utils/waveform';
import { predictVoice } from '../services/api';
import { formatTime, formatBytes } from '../utils/formatters';

export default function RecordView({ backendHealth }) {
  // Session lifecycle states: 'idle' | 'recording' | 'paused' | 'recorded'
  const [sessionState, setSessionState] = useState('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionError, setPermissionError] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordedPeaks, setRecordedPeaks] = useState([]);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Audio recording references
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const processorNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const sampleRateRef = useRef(16000);
  const timerIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isPausedRef = useRef(false);

  const isHealthy = backendHealth?.status === 'healthy';

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAllMediaTracks();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const stopAllMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (analyserNodeRef.current) {
      analyserNodeRef.current.disconnect();
      analyserNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  };

  // Live bouncing waveform bars visualizer (Terracotta & Caramel palette)
  const startLiveVisualizer = useCallback((analyser) => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 52;
      const barWidth = 4;
      const gap = (width - numBars * barWidth) / (numBars - 1);
      const step = Math.max(1, Math.floor(bufferLength / numBars));

      for (let i = 0; i < numBars; i++) {
        const val = dataArray[i * step] || 0;
        const normalized = val / 255.0;
        const barHeight = Math.max(4, normalized * (height * 0.88));
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        if (isPausedRef.current) {
          ctx.fillStyle = '#E6D9CA'; // muted warm border while paused
        } else if (normalized > 0.28) {
          ctx.fillStyle = '#C87555'; // active vocal energy (Terracotta)
        } else if (normalized > 0.08) {
          ctx.fillStyle = '#BD9068'; // harmonic frequency (Caramel)
        } else {
          ctx.fillStyle = '#EFE6DA'; // background room floor
        }

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 2);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
    };

    draw();
  }, []);

  // Guarantee visualizer starts whenever canvas mounts into 'recording' state
  useEffect(() => {
    if (sessionState === 'recording' && analyserNodeRef.current && canvasRef.current) {
      startLiveVisualizer(analyserNodeRef.current);
    }
  }, [sessionState, startLiveVisualizer]);

  const handleStartRecording = async () => {
    setPermissionError(null);
    setError(null);
    setResult(null);
    recordedChunksRef.current = [];
    setRecordingDuration(0);

    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      mediaStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;
      sampleRateRef.current = audioCtx.sampleRate;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyserNodeRef.current = analyser;

      // Audio capture via ScriptProcessor (bufferSize 4096 = ~92ms @ 44.1k / ~256ms @ 16k)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isPausedRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        recordedChunksRef.current.push(new Float32Array(inputData));
      };

      // Mute gain node (gain = 0) to prevent microphone feedback loop
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNodeRef.current = gainNode;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      isPausedRef.current = false;
      setSessionState('recording');

      // Start recording duration timer (updates every 100ms)
      timerIntervalRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          setRecordingDuration((prev) => prev + 0.1);
        }
      }, 100);

    } catch (err) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Microphone permission was denied. Please allow microphone access in your browser settings to record audio.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('No microphone input device detected. Please connect a microphone and try again.');
      } else {
        setPermissionError(err.message || 'Unable to initialize microphone stream.');
      }
      setSessionState('idle');
    }
  };

  const handlePauseResume = () => {
    if (sessionState === 'recording') {
      isPausedRef.current = true;
      setSessionState('paused');
    } else if (sessionState === 'paused') {
      isPausedRef.current = false;
      setSessionState('recording');
      if (analyserNodeRef.current) {
        startLiveVisualizer(analyserNodeRef.current);
      }
    }
  };

  const handleStopRecording = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const capturedChunks = [...recordedChunksRef.current];
    const sRate = sampleRateRef.current || 16000;

    stopAllMediaTracks();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (capturedChunks.length === 0) {
      setSessionState('idle');
      setError('No audio samples were captured during the recording session.');
      return;
    }

    try {
      // Encode lossless 16-bit linear PCM WAV
      const wavBlob = encodeWav(capturedChunks, sRate, 1);
      const url = URL.createObjectURL(wavBlob);
      const totalSamples = capturedChunks.reduce((acc, c) => acc + c.length, 0);
      const durationSec = totalSamples / sRate;

      setRecordedBlob(wavBlob);
      setRecordedUrl(url);
      setRecordedDuration(durationSec);

      // Extract client-side waveform peaks for player
      try {
        const { peaks } = await extractWaveformPeaks(wavBlob, 80);
        setRecordedPeaks(peaks);
      } catch {
        // Fallback
      }

      setSessionState('recorded');
    } catch (err) {
      console.error('Error encoding WAV recording:', err);
      setError('Failed to process captured microphone audio into WAV format.');
      setSessionState('idle');
    }
  };

  const handleRetake = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
    setRecordedPeaks([]);
    setRecordedDuration(0);
    setRecordingDuration(0);
    setResult(null);
    setError(null);
    setPermissionError(null);
    setSessionState('idle');
  };

  const handleVerifyRecording = async () => {
    if (!recordedBlob) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await predictVoice(
        recordedBlob, 
        'microphone_recording.wav', 
        'recording'
      );
      setResult(response);
    } catch (err) {
      setError(err.message || 'An error occurred during audio verification.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Heading & Context */}
      <div className="space-y-1.5">
        <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-widest text-brand-primary font-semibold">
          <Radio className="w-3.5 h-3.5" />
          <span>Studio Recording Suite</span>
        </div>
        <h2 className="editorial-display text-2xl sm:text-3xl font-bold text-espresso tracking-tight">
          Record Audio Stream
        </h2>
        <p className="text-sm text-espresso-secondary max-w-2xl leading-relaxed">
          Capture speech directly via microphone in uncompressed linear PCM. Speak continuously for 3 to 4 seconds for optimal micro-acoustic inspection.
        </p>
      </div>

      {/* Backend Service Notice */}
      {!isHealthy && (
        <div className="p-4 rounded-lg bg-warning-bg border border-warning-border text-xs text-warning flex items-start space-x-3 shadow-soft">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-espresso">Verification Engine Offline</p>
            <p className="text-espresso-secondary">
              Cannot establish connection to the backend engine on port 8000. You may still record audio, but model verification requires the active service.
            </p>
          </div>
        </div>
      )}

      {/* Permission or Hardware Error */}
      {permissionError && (
        <div className="p-4 rounded-lg bg-spoof-bg border border-spoof-border text-xs text-spoof flex items-start space-x-3 shadow-soft">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-espresso">Microphone Access Error</p>
            <p className="text-espresso-secondary">{permissionError}</p>
          </div>
        </div>
      )}

      {/* Workspace Surface */}
      <div className="bg-bg-surface rounded-xl border border-border-subtle p-7 sm:p-9 shadow-card space-y-6">
        {/* State 1: Verification Result Display */}
        {result ? (
          <ResultDisplay result={result} onReset={handleRetake} />
        ) : sessionState === 'recorded' ? (
          /* State 2: Recorded Audio Preview & Verification Confirmation */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div className="flex items-center space-x-3.5">
                <div className="w-9 h-9 rounded-full bg-bonafide-bg border border-bonafide-border flex items-center justify-center text-bonafide shadow-soft">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-espresso">Recording Ready</h3>
                  <p className="text-[11px] text-espresso-secondary font-mono">
                    {recordedDuration.toFixed(1)}s linear 16-bit PCM WAV
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-[11px] font-mono bg-bg-secondary text-espresso-secondary border border-border-subtle">
                {recordedBlob ? formatBytes(recordedBlob.size) : ''}
              </span>
            </div>

            {/* Interactive Waveform Player */}
            <div className="border border-border-subtle rounded-xl p-4 bg-bg-secondary/30">
              <WaveformPlayer
                audioUrl={recordedUrl}
                peaks={recordedPeaks}
                duration={recordedDuration}
              />
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 rounded-lg bg-spoof-bg border border-spoof-border text-xs text-spoof flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetake}
                disabled={isAnalyzing}
                className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-bg-surface hover:bg-bg-secondary border border-border-subtle text-xs font-medium text-espresso rounded-md transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 text-brand-primary" />
                <span>Retake Audio</span>
              </button>

              <button
                type="button"
                onClick={handleVerifyRecording}
                disabled={isAnalyzing}
                className="inline-flex items-center justify-center space-x-2.5 px-7 py-3 bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface text-xs font-semibold uppercase tracking-wider rounded-md transition-all shadow-soft disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Audio...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Verify Recording</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : sessionState === 'recording' || sessionState === 'paused' ? (
          /* State 3: Active Recording Session with Live Waveform */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div className="flex items-center space-x-3">
                <span className="relative flex h-3 w-3">
                  {sessionState === 'recording' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-terracotta opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      sessionState === 'recording' ? 'bg-brand-terracotta' : 'bg-warning'
                    }`}
                  />
                </span>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-espresso">
                  {sessionState === 'recording' ? 'Recording In Progress' : 'Recording Paused'}
                </span>
              </div>

              {/* Running Time Display */}
              <div className="flex items-center space-x-2 font-mono text-xl font-bold text-espresso">
                <Clock className="w-4 h-4 text-brand-terracotta" />
                <span>{formatTime(recordingDuration)}</span>
              </div>
            </div>

            {/* Live Bouncing Waveform Canvas Container */}
            <div className="apple-card bg-bg-secondary/40 border border-border-subtle rounded-xl p-6 flex flex-col items-center justify-center min-h-[170px] shadow-soft">
              <canvas
                ref={canvasRef}
                width={560}
                height={100}
                className="w-full max-w-lg h-24"
              />
              <p className="text-[11px] text-espresso-secondary font-mono mt-3">
                {sessionState === 'recording'
                  ? 'Speak clearly into your microphone &bull; Target: 4.00s'
                  : 'Recording paused. Click Resume to continue speaking.'}
              </p>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handlePauseResume}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-bg-surface hover:bg-bg-secondary border border-border-subtle text-xs font-medium text-espresso rounded-md transition-all shadow-soft"
              >
                {sessionState === 'recording' ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-espresso-secondary" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-espresso-secondary" />
                    <span>Resume</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleStopRecording}
                className="inline-flex items-center space-x-2 px-6 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop &amp; Preview</span>
              </button>
            </div>
          </div>
        ) : (
          /* State 4: Initial Idle Studio Ready State */
          <div className="py-12 flex flex-col items-center text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-brand-primary-subtle border border-border-subtle flex items-center justify-center text-brand-primary shadow-soft">
              <Mic className="w-7 h-7" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="font-serif font-bold text-xl text-espresso">
                Microphone Studio Ready
              </h3>
              <p className="text-xs text-espresso-secondary leading-relaxed">
                Capture voice audio in uncompressed 16-bit PCM. Speak naturally for at least 3 to 4 seconds to enable robust micro-acoustic feature extraction.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartRecording}
                className="inline-flex items-center space-x-2.5 px-7 py-3 bg-brand-primary hover:bg-brand-deep text-bg-surface text-xs font-semibold uppercase tracking-wider rounded-md transition-all shadow-soft"
              >
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            </div>

            <div className="flex items-center space-x-4 pt-3 text-[11px] font-mono text-espresso-muted">
              <span>&bull; In-browser capture</span>
              <span>&bull; Linear PCM</span>
              <span>&bull; Zero cloud transmission</span>
            </div>
          </div>
        )}
      </div>

      {/* Technical Protocol Notes */}
      <div className="px-2 text-[11px] font-mono text-espresso-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span>Processing: Native AudioContext &rarr; 16-bit PCM WAV &rarr; LFCC Extraction &rarr; AudioCNN</span>
        <span>Storage: Results telemetry only &bull; No raw audio retained</span>
      </div>
    </div>
  );
}
