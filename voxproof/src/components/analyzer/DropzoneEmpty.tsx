"use client";

import React, { useRef, useState, useEffect } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { api } from "@/lib/api/client";
import { Barcode } from "../common/Barcode";
import {
  UploadCloud,
  Mic,
  Square,
  Sparkles,
  AlertCircle,
  FileAudio,
} from "lucide-react";

export const DropzoneEmpty: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const setFile = useAnalyzerStore((s) => s.setFile);
  const setStatus = useAnalyzerStore((s) => s.setStatus);
  const setStage = useAnalyzerStore((s) => s.setStage);
  const setResult = useAnalyzerStore((s) => s.setResult);
  const setError = useAnalyzerStore((s) => s.setError);

  const processFile = async (selectedFile: File) => {
    setErrorMsg(null);

    // Validate size (max 25 MB)
    if (selectedFile.size > 25 * 1024 * 1024) {
      setErrorMsg("File exceeds 25 MB limit. Please select a shorter audio segment.");
      return;
    }

    setFile(selectedFile);
    setStatus("processing");

    try {
      const res = await api.analyzeFile(selectedFile, (st, pct) => {
        setStage(st, pct);
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to complete audio classification.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleSample = (sampleType: "bonafide" | "spoof") => {
    const filename =
      sampleType === "bonafide"
        ? "sample_human_studio_speech.wav"
        : "sample_synthesized_tts_elevenlabs.mp3";
    const fakeBlob = new Blob(["PCM_FORENSIC_AUDIO"], { type: "audio/wav" });
    const file = new File([fakeBlob], filename, { type: "audio/wav" });
    processFile(file);
  };

  // Start / Stop microphone recording
  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Setup Web Audio analyser
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const recFile = new File([audioBlob], `mic_recording_${Date.now()}.wav`, {
          type: "audio/wav",
        });
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx.state !== "closed") audioCtx.close();
        processFile(recFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      // Start canvas FFT draw loop
      const drawVisualizer = () => {
        const canvas = visualizerCanvasRef.current;
        if (canvas && analyserRef.current) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barW = canvas.width / dataArray.length;
            for (let i = 0; i < dataArray.length; i++) {
              const barH = (dataArray[i] / 255) * canvas.height;
              ctx.fillStyle = "#C6FF3D";
              ctx.fillRect(i * barW, canvas.height - barH, barW - 1, barH);
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(drawVisualizer);
      };
      drawVisualizer();
    } catch {
      setErrorMsg("Microphone access denied or audio device unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(recordIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 py-6 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-bonafide block">
            // CONSOLE INPUT STAGE
          </span>
          <h2 className="font-display font-black text-3xl uppercase tracking-tight text-white mt-1">
            Ingest Acoustic Target
          </h2>
        </div>
        <Barcode value="VX-INGEST-A" height={18} showText={false} />
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-spoof/10 border border-spoof/30 text-spoof flex items-center gap-3 font-mono text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Reactive Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative w-full rounded-card border-2 border-dashed p-12 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer min-h-[380px] ${
          isDragOver
            ? "border-bonafide bg-ink-2 shadow-2xl shadow-bonafide/10 scale-[1.01]"
            : "border-line hover:border-lineHover bg-ink-2/60"
        }`}
      >
        <input
          id="analyzer-file-input"
          type="file"
          accept=".wav,.mp3,.flac,.ogg,.m4a"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {/* Center Drop Graphic */}
        <div className="flex flex-col items-center gap-4 pointer-events-none">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center border transition-all ${
              isDragOver
                ? "bg-bonafide text-ink border-bonafide scale-110"
                : "bg-ink-3 text-muted border-line"
            }`}
          >
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-display font-black text-2xl uppercase tracking-tight text-white">
              Drop Audio File To Begin Verification
            </span>
            <span className="font-mono text-xs text-muted">
              Supported: WAV, MP3, FLAC, OGG, M4A · Max 25 MB · Min 1.0s Duration
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2 px-4 py-1.5 rounded-full bg-ink-3 border border-line font-mono text-[11px] text-bonafide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Harmonized 60-Band LFCC Feature Extraction</span>
          </div>
        </div>
      </div>

      {/* Auxiliary Ingestion Controls (Microphone & Pre-seeded Samples) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Mic Recording Card */}
        <div className="md:col-span-6 p-5 rounded-2xl bg-ink-2 border border-line flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-bonafide" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Direct Microphone Capture
              </span>
            </div>
            {isRecording && (
              <span className="font-mono text-xs font-bold text-spoof animate-pulse">
                REC 00:{recordDuration.toString().padStart(2, "0")}
              </span>
            )}
          </div>

          {isRecording ? (
            <div className="flex flex-col gap-3">
              <canvas
                ref={visualizerCanvasRef}
                width={300}
                height={40}
                className="w-full h-10 rounded-lg bg-ink border border-line"
              />
              <button
                onClick={stopRecording}
                className="w-full py-2.5 rounded-full bg-spoof text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop & Classify Audio</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-[11px] text-muted">
                Record directly from active hardware input. Streamed in-memory.
              </p>
              <button
                onClick={startRecording}
                className="w-full py-2.5 rounded-full bg-ink-3 hover:bg-line border border-line text-white font-mono text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <Mic className="w-3.5 h-3.5 text-bonafide" />
                <span>Record From Microphone</span>
              </button>
            </div>
          )}
        </div>

        {/* Pre-seeded Samples */}
        <div className="md:col-span-6 p-5 rounded-2xl bg-ink-2 border border-line flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Benchmark Sample Library
              </span>
              <FileAudio className="w-4 h-4 text-muted" />
            </div>
            <p className="font-mono text-[11px] text-muted mb-4">
              Instantly test authenticated bonafide human or neural vocoder spoof files.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleSample("bonafide")}
              className="flex-1 py-2.5 rounded-full bg-ink-3 hover:border-bonafide border border-line text-bonafide font-mono text-xs uppercase font-bold tracking-wider transition-all"
            >
              Try Bonafide
            </button>
            <button
              onClick={() => handleSample("spoof")}
              className="flex-1 py-2.5 rounded-full bg-ink-3 hover:border-spoof border border-line text-spoof font-mono text-xs uppercase font-bold tracking-wider transition-all"
            >
              Try Spoof
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
