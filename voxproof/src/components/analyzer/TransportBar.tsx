"use client";

import React, { useEffect, useRef } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react";

export const TransportBar: React.FC = () => {
  const result = useAnalyzerStore((s) => s.result);
  const isPlaying = useAnalyzerStore((s) => s.isPlaying);
  const currentTime = useAnalyzerStore((s) => s.currentTime);
  const volume = useAnalyzerStore((s) => s.volume);
  const playbackSpeed = useAnalyzerStore((s) => s.playbackSpeed);
  const loopSegmentIndex = useAnalyzerStore((s) => s.loopSegmentIndex);

  const setIsPlaying = useAnalyzerStore((s) => s.setIsPlaying);
  const setCurrentTime = useAnalyzerStore((s) => s.setCurrentTime);
  const setVolume = useAnalyzerStore((s) => s.setVolume);
  const setPlaybackSpeed = useAnalyzerStore((s) => s.setPlaybackSpeed);
  const setLoopSegmentIndex = useAnalyzerStore((s) => s.setLoopSegmentIndex);

  const duration = result?.duration_s || 4.0;
  const timerRef = useRef<any>(null);

  // Simulated synthetic playback ticker for canvas waveforms
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        const step = 0.05 * playbackSpeed;
        const nextTime = currentTime + step;

        if (loopSegmentIndex !== null && result?.segments[loopSegmentIndex]) {
          const seg = result.segments[loopSegmentIndex];
          if (nextTime >= seg.end_s) {
            setCurrentTime(seg.start_s);
          } else {
            setCurrentTime(nextTime);
          }
        } else {
          if (nextTime >= duration) {
            setCurrentTime(0);
            setIsPlaying(false);
          } else {
            setCurrentTime(nextTime);
          }
        }
      }, 50);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    loopSegmentIndex,
    result,
    setCurrentTime,
    setIsPlaying,
  ]);

  const handlePrevSegment = () => {
    if (!result) return;
    const currentIdx = result.segments.findIndex(
      (s) => currentTime >= s.start_s && currentTime <= s.end_s
    );
    if (currentIdx > 0) {
      setCurrentTime(result.segments[currentIdx - 1].start_s);
    } else {
      setCurrentTime(0);
    }
  };

  const handleNextSegment = () => {
    if (!result) return;
    const currentIdx = result.segments.findIndex(
      (s) => currentTime >= s.start_s && currentTime <= s.end_s
    );
    if (currentIdx < result.segments.length - 1 && currentIdx >= 0) {
      setCurrentTime(result.segments[currentIdx + 1].start_s);
    } else {
      setCurrentTime(0);
    }
  };

  const formatTime = (secs: number) => {
    const mm = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const ss = (secs % 60).toFixed(1).padStart(4, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-ink-2/95 backdrop-blur-lg border-t border-line px-4 sm:px-8 py-3.5 flex items-center justify-between select-none shadow-2xl">
      {/* Left Transport Controls */}
      <div className="flex items-center gap-4">
        {/* Prev Segment */}
        <button
          onClick={handlePrevSegment}
          className="p-2 rounded-full hover:bg-ink-3 text-muted hover:text-white transition-colors"
          title="Previous Segment"
          aria-label="Previous Segment"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play / Pause Toggle Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          data-cursor="PLAY"
          className="w-10 h-10 rounded-full bg-white text-ink flex items-center justify-center hover:bg-bonafide hover:scale-105 active:scale-95 transition-all shadow-md"
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Next Segment */}
        <button
          onClick={handleNextSegment}
          className="p-2 rounded-full hover:bg-ink-3 text-muted hover:text-white transition-colors"
          title="Next Segment"
          aria-label="Next Segment"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Loop Segment Toggle */}
        <button
          onClick={() => {
            if (loopSegmentIndex === null) {
              // Find current segment index
              const idx = result?.segments.findIndex(
                (s) => currentTime >= s.start_s && currentTime <= s.end_s
              );
              setLoopSegmentIndex(idx !== -1 && idx !== undefined ? idx : 0);
            } else {
              setLoopSegmentIndex(null);
            }
          }}
          className={`p-2 rounded-full transition-colors ${
            loopSegmentIndex !== null
              ? "bg-bonafide/20 text-bonafide border border-bonafide/40"
              : "hover:bg-ink-3 text-muted hover:text-white"
          }`}
          title={
            loopSegmentIndex !== null
              ? `Looping Segment #${loopSegmentIndex + 1}`
              : "Loop Current Segment"
          }
          aria-label="Loop current audio segment"
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Time counter */}
        <div className="font-mono text-xs tracking-wider text-muted hidden sm:flex items-center gap-1.5 ml-2">
          <span className="text-white font-bold">{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Center Track Meta */}
      <div className="hidden md:flex flex-col items-center max-w-sm truncate">
        <span className="font-mono text-xs font-bold text-white truncate">
          {result?.filename || "No audio loaded"}
        </span>
        <span className="font-mono text-[10px] text-muted">
          16.0 kHz PCM · AudioCNN Inference Active
        </span>
      </div>

      {/* Right Volume & Speed Controls */}
      <div className="flex items-center gap-4">
        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-ink p-1 rounded-full border border-line">
          {[0.5, 1.0, 1.5].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold transition-colors ${
                playbackSpeed === speed
                  ? "bg-white text-ink"
                  : "text-muted hover:text-white"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 1)}
            className="text-muted hover:text-white transition-colors"
            aria-label="Toggle mute"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 bg-ink-3 rounded-lg accent-bonafide cursor-pointer"
            aria-label="Volume slider"
          />
        </div>
      </div>
    </div>
  );
};
