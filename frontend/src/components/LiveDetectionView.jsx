import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Radio, 
  Square, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Activity, 
  Clock, 
  Layers, 
  Wifi, 
  WifiOff, 
  ShieldAlert,
  Volume2,
  TrendingUp,
  Cpu,
  Sparkles,
  ShieldCheck,
  Disc
} from 'lucide-react';
import { getLiveWebSocketUrl } from '../services/api';
import { resampleAudio } from '../utils/wavEncoder';
import { formatTime, formatPercent } from '../utils/formatters';

const LIVE_STATES = {
  IDLE: { label: 'Idle', color: 'text-espresso-secondary', bg: 'bg-bg-secondary', border: 'border-border-subtle' },
  REQUESTING: { label: 'Requesting Mic Access', color: 'text-brand-terracotta', bg: 'bg-brand-terracotta-subtle', border: 'border-brand-terracotta/30' },
  LISTENING: { label: 'Listening', color: 'text-brand-primary', bg: 'bg-brand-primary-subtle', border: 'border-brand-primary/30' },
  COLLECTING: { label: 'Collecting Audio', color: 'text-brand-primary', bg: 'bg-brand-primary-subtle', border: 'border-brand-primary/30' },
  SPEECH: { label: 'Speech Detected', color: 'text-brand-terracotta', bg: 'bg-brand-terracotta-subtle', border: 'border-brand-terracotta/30' },
  ANALYZING: { label: 'Analyzing Window', color: 'text-brand-terracotta', bg: 'bg-brand-terracotta-subtle', border: 'border-brand-terracotta/30' },
  BONAFIDE: { label: 'BONAFIDE', color: 'text-bonafide', bg: 'bg-bonafide-bg', border: 'border-bonafide-border' },
  SPOOF: { label: 'SPOOF', color: 'text-spoof', bg: 'bg-spoof-bg', border: 'border-spoof-border' },
  INSUFFICIENT: { label: 'Silence / Low Energy', color: 'text-warning', bg: 'bg-warning-bg', border: 'border-warning-border' },
  STOPPED: { label: 'Session Stopped', color: 'text-espresso-secondary', bg: 'bg-bg-secondary', border: 'border-border-subtle' },
  ERROR: { label: 'Connection Error', color: 'text-spoof', bg: 'bg-spoof-bg', border: 'border-spoof-border' },
};

export default function LiveDetectionView({ backendHealth }) {
  const [sessionStatus, setSessionStatus] = useState('IDLE');
  const [isActive, setIsActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [bufferingProgress, setBufferingProgress] = useState(0);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);

  const [latestPrediction, setLatestPrediction] = useState(null);
  const [smoothedScore, setSmoothedScore] = useState(null);
  const [smoothedLabel, setSmoothedLabel] = useState(null);
  const [rmsEnergy, setRmsEnergy] = useState(0);
  const [totalWindows, setTotalWindows] = useState(0);
  const [activeSpeechWindows, setActiveSpeechWindows] = useState(0);
  const [silenceWindows, setSilenceWindows] = useState(0);
  const [recentEvents, setRecentEvents] = useState([]);
  const [lastAnalysisTime, setLastAnalysisTime] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);

  const [errorMessage, setErrorMessage] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const processorNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sessionActiveRef = useRef(false);
  const lastRmsUpdateRef = useRef(0);

  const isHealthy = backendHealth?.status === 'healthy';

  useEffect(() => {
    return () => {
      stopLiveSession(false);
    };
  }, []);

  // Idle resting waveform baseline bars (Terracotta/Caramel theme)
  const drawIdleVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const numBars = 52;
    const barWidth = 4;
    const gap = (width - numBars * barWidth) / (numBars - 1);
    const restingHeight = 4;

    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth + gap);
      const y = (height - restingHeight) / 2;
      ctx.fillStyle = '#E6D9CA';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, restingHeight, 2);
      } else {
        ctx.rect(x, y, barWidth, restingHeight);
      }
      ctx.fill();
    }
  }, []);

  const stopAllHardwareTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
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
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    sessionActiveRef.current = false;
  }, []);

  // Live bouncing waveform bars visualizer matching Studio Voice Capture (RecordView)
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
      if (!sessionActiveRef.current) {
        drawIdleVisualizer();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Throttled real-time reactive RMS computation (~100ms)
      const now = performance.now();
      if (now - lastRmsUpdateRef.current > 100) {
        lastRmsUpdateRef.current = now;
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const norm = dataArray[i] / 255.0;
          sumSquares += norm * norm;
        }
        const instantRms = Math.sqrt(sumSquares / bufferLength);
        setRmsEnergy(instantRms);
      }

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

        if (normalized > 0.28) {
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
  }, [drawIdleVisualizer]);

  // Initial mount: render clean idle resting waveform baseline
  useEffect(() => {
    drawIdleVisualizer();
  }, [drawIdleVisualizer]);

  // Ensure live visualizer starts whenever active state or canvas mounts
  useEffect(() => {
    if (isActive && analyserNodeRef.current && canvasRef.current) {
      startLiveVisualizer(analyserNodeRef.current);
    } else if (!isActive) {
      drawIdleVisualizer();
    }
  }, [isActive, startLiveVisualizer, drawIdleVisualizer]);

  const startLiveSession = async () => {
    setErrorMessage(null);
    setSessionSummary(null);
    setRecentEvents([]);
    setLatestPrediction(null);
    setSmoothedScore(null);
    setSmoothedLabel(null);
    setTotalWindows(0);
    setActiveSpeechWindows(0);
    setSilenceWindows(0);
    setSessionDuration(0);
    setBufferingProgress(0);
    setBufferedSeconds(0);
    setSessionStatus('REQUESTING');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio streaming is not supported in this browser environment.');
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

      const wsUrl = getLiveWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setWsConnected(true);
        setSessionStatus('LISTENING');
        timerIntervalRef.current = setInterval(() => {
          setSessionDuration((prev) => prev + 1);
        }, 1000);
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (sessionActiveRef.current) {
          setSessionStatus('STOPPED');
          sessionActiveRef.current = false;
          setIsActive(false);
          drawIdleVisualizer();
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
        setSessionStatus('ERROR');
        setErrorMessage('Failed to connect to VoiceGuard live streaming service on port 8000.');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (err) {
          console.warn('Non-JSON WebSocket message received:', err);
        }
      };

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyserNodeRef.current = analyser;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!sessionActiveRef.current || ws.readyState !== WebSocket.OPEN) return;
        const channelData = e.inputBuffer.getChannelData(0);
        let pcm16k = channelData;
        if (audioCtx.sampleRate !== 16000) {
          pcm16k = resampleAudio(channelData, audioCtx.sampleRate, 16000);
        }
        ws.send(pcm16k.buffer);
      };

      // GainNode with gain = 0 prevents speaker feedback loops
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNodeRef.current = gainNode;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      sessionActiveRef.current = true;
      setIsActive(true);
      startLiveVisualizer(analyser);

    } catch (err) {
      console.error('Failed to start live detection session:', err);
      stopAllHardwareTracks();
      drawIdleVisualizer();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please grant microphone permission to enable live detection.');
      } else {
        setErrorMessage(err.message || 'Unable to initialize live audio capture stream.');
      }
      setSessionStatus('ERROR');
      setIsActive(false);
      sessionActiveRef.current = false;
    }
  };

  const handleWebSocketMessage = (data) => {
    if (!data || !data.type) return;

    if (data.type === 'connected') {
      setSessionStatus('COLLECTING');
    } else if (data.type === 'buffering') {
      setSessionStatus('COLLECTING');
      setBufferingProgress(data.progress_pct || 0);
      setBufferedSeconds(data.buffered_seconds || 0);
    } else if (data.type === 'silence') {
      setSessionStatus('INSUFFICIENT');
      setRmsEnergy(data.rms_energy || 0);
      setSilenceWindows((prev) => prev + 1);
    } else if (data.type === 'prediction') {
      const isSpoof = data.predicted_class === 'SPOOF';
      setSessionStatus(isSpoof ? 'SPOOF' : 'BONAFIDE');
      setLatestPrediction(data);
      setSmoothedScore(data.smoothed_score);
      setSmoothedLabel(data.smoothed_label);
      setRmsEnergy(data.rms_energy || 0);
      setLastAnalysisTime(new Date().toLocaleTimeString());
      setActiveSpeechWindows((prev) => prev + 1);
      setTotalWindows((prev) => prev + 1);

      setRecentEvents((prev) => [
        {
          id: `${data.session_id}_${data.window_index}_${Date.now()}`,
          index: data.window_index,
          verdict: data.predicted_class,
          confidence: data.confidence,
          smoothed: data.smoothed_score,
          time: new Date().toLocaleTimeString(),
          latency: data.processing_time_ms,
          rms: data.rms_energy,
        },
        ...prev.slice(0, 11),
      ]);
    } else if (data.type === 'session_stopped') {
      setSessionStatus('STOPPED');
      setSessionSummary(data.summary);
      setIsActive(false);
      sessionActiveRef.current = false;
    } else if (data.type === 'error') {
      setSessionStatus('ERROR');
      setErrorMessage(data.message || 'Inference engine reported an error.');
    }
  };

  const stopLiveSession = (notifyBackend = true) => {
    sessionActiveRef.current = false;
    setIsActive(false);

    if (notifyBackend && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      } catch {}
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    stopAllHardwareTracks();
    setWsConnected(false);
    if (sessionStatus !== 'ERROR') {
      setSessionStatus('STOPPED');
    }
    setRmsEnergy(0);
    drawIdleVisualizer();
  };

  const handleResetSession = () => {
    stopLiveSession(false);
    setSessionStatus('IDLE');
    setRecentEvents([]);
    setLatestPrediction(null);
    setSmoothedScore(null);
    setSmoothedLabel(null);
    setTotalWindows(0);
    setActiveSpeechWindows(0);
    setSilenceWindows(0);
    setSessionDuration(0);
    setSessionSummary(null);
    setErrorMessage(null);
    setRmsEnergy(0);
    drawIdleVisualizer();
  };

  const currentStateConfig = LIVE_STATES[sessionStatus] || LIVE_STATES.IDLE;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Heading & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-widest text-brand-caramel font-semibold">
            <Radio className="w-3.5 h-3.5" />
            <span>Continuous Monitoring</span>
          </div>
          <h2 className="editorial-display text-2xl sm:text-3xl font-bold text-espresso tracking-tight">
            Live Stream Verification
          </h2>
          <p className="text-sm text-espresso-secondary">
            Continuous real-time speech verification through active microphone streaming and sliding-window CNN inference.
          </p>
        </div>

        {/* Live Indicator Badge */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <div
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full border ${currentStateConfig.bg} ${currentStateConfig.border} ${currentStateConfig.color} font-medium shadow-soft`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isActive ? 'animate-pulse bg-current' : 'bg-espresso-muted'
              }`}
            />
            <span>{currentStateConfig.label}</span>
          </div>
        </div>
      </div>

      {/* Backend Service Offline Alert */}
      {!isHealthy && (
        <div className="p-4 rounded-lg bg-warning-bg border border-warning-border text-xs text-warning flex items-start space-x-3 shadow-soft">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-espresso">Live Service Degraded</p>
            <p className="text-espresso-secondary">
              Cannot establish connection to local backend on port 8000. Ensure the background service is running to process live streams.
            </p>
          </div>
        </div>
      )}

      {/* Hardware / WebSocket Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-spoof-bg border border-spoof-border text-xs text-spoof flex items-start space-x-3 shadow-soft">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-espresso">Streaming Transport Error</p>
            <p className="text-espresso-secondary">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Primary Live Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Real-Time Verdict Card & Visualizer */}
        <div className="lg:col-span-8 space-y-5">
          <div className="apple-card bg-bg-surface rounded-xl border border-border-subtle p-7 shadow-card space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <span className="text-xs font-mono uppercase tracking-wider text-espresso-secondary font-semibold">
                Real-Time Audio Stream
              </span>
              <div className="flex items-center space-x-2 text-xs font-mono text-espresso-secondary">
                <Clock className="w-3.5 h-3.5 text-brand-primary" />
                <span>Elapsed: {formatTime(sessionDuration)}</span>
              </div>
            </div>

            {/* Verdict Display Banner */}
            <div
              className={`p-6 rounded-xl border transition-colors duration-200 shadow-soft ${
                sessionStatus === 'BONAFIDE'
                  ? 'bg-bonafide-bg border-bonafide-border'
                  : sessionStatus === 'SPOOF'
                  ? 'bg-spoof-bg border-spoof-border'
                  : sessionStatus === 'INSUFFICIENT'
                  ? 'bg-warning-bg border-warning-border'
                  : 'bg-bg-secondary/40 border-border-subtle'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-espresso-muted font-semibold">
                    Live Acoustic Status
                  </div>
                  <div className="flex items-baseline space-x-3">
                    <span
                      className={`text-2xl sm:text-3xl font-mono font-bold tracking-tight ${
                        sessionStatus === 'BONAFIDE'
                          ? 'text-bonafide'
                          : sessionStatus === 'SPOOF'
                          ? 'text-spoof'
                          : sessionStatus === 'INSUFFICIENT'
                          ? 'text-warning'
                          : 'text-espresso'
                      }`}
                    >
                      {sessionStatus === 'BONAFIDE'
                        ? 'BONAFIDE'
                        : sessionStatus === 'SPOOF'
                        ? 'SPOOF'
                        : sessionStatus === 'INSUFFICIENT'
                        ? 'SILENCE / LOW ENERGY'
                        : sessionStatus === 'COLLECTING'
                        ? `BUFFERING (${bufferingProgress.toFixed(0)}%)`
                        : sessionStatus === 'LISTENING'
                        ? 'AWAITING SPEECH'
                        : currentStateConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-espresso-secondary leading-relaxed">
                    {sessionStatus === 'BONAFIDE'
                      ? 'Authentic human vocal tract acoustics verified.'
                      : sessionStatus === 'SPOOF'
                      ? 'Synthetic neural vocoder or voice conversion characteristics detected.'
                      : sessionStatus === 'INSUFFICIENT'
                      ? 'RMS energy below vocal threshold (RMS < 0.0050). Silence gate active.'
                      : sessionStatus === 'COLLECTING'
                      ? `Accumulating 4.0s sliding window (${bufferedSeconds.toFixed(1)}s / 4.0s)...`
                      : 'Streamed audio is processed in continuous 4.00s overlapping sliding windows.'}
                  </p>
                </div>

                {/* Latest Confidence Gauge */}
                <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-border-subtle pt-3 sm:pt-0 sm:pl-6 shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-espresso-muted font-semibold">
                    Confidence
                  </div>
                  <div
                    className={`text-3xl font-mono font-bold ${
                      sessionStatus === 'BONAFIDE'
                        ? 'text-bonafide'
                        : sessionStatus === 'SPOOF'
                        ? 'text-spoof'
                        : 'text-espresso-muted'
                    }`}
                  >
                    {latestPrediction ? formatPercent(latestPrediction.confidence) : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-espresso-muted mt-0.5">
                    {lastAnalysisTime ? `Window ${lastAnalysisTime}` : 'Awaiting input'}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Audio Oscilloscope Bar Visualizer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-espresso-secondary">
                <span className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Spectral Microphone Activity</span>
                </span>
                <span>RMS: {rmsEnergy.toFixed(4)}</span>
              </div>
              <div className="apple-card bg-bg-secondary/40 border border-border-subtle rounded-xl p-5 flex flex-col items-center justify-center min-h-[160px] shadow-soft">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={100}
                  className="w-full max-w-lg h-24"
                />
                <p className="text-[11px] text-espresso-secondary font-mono mt-3">
                  {isActive
                    ? 'Speak clearly into your microphone • Reactive acoustic waveform'
                    : 'Microphone inactive • Click "Start Live Stream" to begin live acoustic analysis'}
                </p>
              </div>
            </div>

            {/* Smoothing & Probability Indicators */}
            {latestPrediction && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-border-subtle">
                {/* Temporal EMA Smoothed Score */}
                <div className="p-4 bg-bg-secondary/30 rounded-xl border border-border-subtle space-y-1.5 shadow-soft">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-espresso-secondary">Smoothed Spoof Tendency</span>
                    <span className="font-semibold text-espresso">
                      {smoothedScore !== null ? formatPercent(smoothedScore) : '—'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className={`h-full transition-all duration-300 ${
                        (smoothedScore || 0) >= 0.50 ? 'bg-spoof' : 'bg-bonafide'
                      }`}
                      style={{ width: `${(smoothedScore || 0) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-espresso-muted flex justify-between">
                    <span>EMA &alpha; = 0.40</span>
                    <span>Verdict: {smoothedLabel || '—'}</span>
                  </div>
                </div>

                {/* Raw Model Inference Telemetry */}
                <div className="p-4 bg-bg-secondary/30 rounded-xl border border-border-subtle font-mono text-xs space-y-1.5 shadow-soft">
                  <div className="flex justify-between text-espresso-secondary">
                    <span>Raw CNN Logit:</span>
                    <span className="text-espresso font-semibold">{latestPrediction.raw_logit?.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-espresso-secondary">
                    <span>Decision Cutoff:</span>
                    <span className="text-espresso">{latestPrediction.threshold?.toFixed(4) || '0.1590'}</span>
                  </div>
                  <div className="flex justify-between text-espresso-secondary">
                    <span>Inference Latency:</span>
                    <span className="text-espresso">{latestPrediction.processing_time_ms} ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* Session Action Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2.5">
                {!isActive ? (
                  <button
                    type="button"
                    onClick={startLiveSession}
                    className="inline-flex items-center space-x-2 px-6 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft uppercase tracking-wider"
                  >
                    <Radio className="w-4 h-4" />
                    <span>Start Listening</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => stopLiveSession(true)}
                    className="inline-flex items-center space-x-2 px-6 py-2.5 bg-spoof hover:bg-spoof/90 text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft uppercase tracking-wider"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop Listening</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={isActive}
                  className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-bg-surface hover:bg-bg-secondary border border-border-subtle text-xs font-medium text-espresso rounded-md transition-all disabled:opacity-40 shadow-soft"
                  title="Clear session history"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-espresso-muted">
                4.0s window &bull; 1.0s hop &bull; 16 kHz mono
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Session Telemetry & Event Timeline */}
        <div className="lg:col-span-4 space-y-5">
          {/* Session Cumulative Stats Card */}
          <div className="apple-card bg-bg-surface rounded-xl border border-border-subtle p-5 space-y-3 font-mono text-xs shadow-card">
            <span className="font-serif font-bold text-sm text-espresso block pb-2 border-b border-border-subtle">
              Live Session Telemetry
            </span>

            <div className="space-y-2.5 text-[11px]">
              <div className="flex justify-between text-espresso-secondary">
                <span>Duration:</span>
                <span className="text-espresso font-semibold">{formatTime(sessionDuration)}</span>
              </div>
              <div className="flex justify-between text-espresso-secondary">
                <span>Total Windows:</span>
                <span className="text-espresso">{totalWindows}</span>
              </div>
              <div className="flex justify-between text-espresso-secondary">
                <span>Speech Windows:</span>
                <span className="text-bonafide font-semibold">{activeSpeechWindows}</span>
              </div>
              <div className="flex justify-between text-espresso-secondary">
                <span>Silence / Skipped:</span>
                <span className="text-espresso-muted">{silenceWindows}</span>
              </div>
              <div className="flex justify-between text-espresso-secondary">
                <span>Hardware Transport:</span>
                <span className="text-espresso font-semibold">Local WebSocket</span>
              </div>
            </div>
          </div>

          {/* Window Verdict History Timeline */}
          <div className="bg-bg-surface rounded-xl border border-border-subtle p-5 space-y-3 shadow-card">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <span className="font-serif font-bold text-sm text-espresso">
                Detection Window Stream
              </span>
              <span className="text-[10px] font-mono text-espresso-muted">
                {recentEvents.length} items
              </span>
            </div>

            {recentEvents.length === 0 ? (
              <div className="py-10 text-center text-xs text-espresso-muted font-mono">
                No windows evaluated yet. Click Start Listening to begin stream.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {recentEvents.map((evt) => {
                  const isSpoof = evt.verdict === 'SPOOF';
                  return (
                    <div
                      key={evt.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-mono transition-colors ${
                        isSpoof
                          ? 'bg-spoof-bg border-spoof-border text-spoof'
                          : 'bg-bonafide-bg border-bonafide-border text-bonafide'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">#{evt.index}</span>
                        <span className="font-semibold">{evt.verdict}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span>{formatPercent(evt.confidence)}</span>
                        <span className="text-espresso-muted text-[10px]">{evt.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Completed Session Summary Alert */}
      {sessionSummary && (
        <div className="p-5 rounded-xl border border-border-subtle bg-bg-surface shadow-card space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-border-subtle">
            <span className="font-semibold text-espresso uppercase">Session Summary Recorded</span>
            <span className="text-espresso-muted">ID: {sessionSummary.session_id}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-espresso-secondary block text-[10px]">Overall Verdict</span>
              <span
                className={`font-bold ${
                  sessionSummary.overall_verdict === 'SPOOF' ? 'text-spoof' : 'text-bonafide'
                }`}
              >
                {sessionSummary.overall_verdict}
              </span>
            </div>
            <div>
              <span className="text-espresso-secondary block text-[10px]">Mean Confidence</span>
              <span className="font-semibold text-espresso">
                {formatPercent(sessionSummary.mean_confidence)}
              </span>
            </div>
            <div>
              <span className="text-espresso-secondary block text-[10px]">Speech Analyzed</span>
              <span className="text-espresso">
                {sessionSummary.speech_windows} windows ({sessionSummary.speech_duration_sec}s)
              </span>
            </div>
            <div>
              <span className="text-espresso-secondary block text-[10px]">Database Status</span>
              <span className="text-bonafide font-semibold">Persisted to History</span>
            </div>
          </div>
        </div>
      )}

      {/* Non-card Footer Notes */}
      <div className="px-2 text-[11px] font-mono text-espresso-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span>Continuous Pipeline: 16 kHz Float32 PCM &rarr; VAD Gate (0.0050) &rarr; 64k Window &rarr; AudioCNN</span>
        <span>Zero raw audio saved &bull; Single session summary telemetry logged upon completion</span>
      </div>
    </div>
  );
}
