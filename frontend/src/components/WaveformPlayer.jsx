import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '../utils/formatters';

export default function WaveformPlayer({
  audioUrl,
  peaks = [],
  duration = 0,
  onEnded,
  compact = false,
}) {
  const audioRef = useRef(null);
  const waveformRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(null);

  useEffect(() => {
    if (duration > 0) {
      setAudioDuration(duration);
    }
  }, [duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (!duration || duration <= 0) {
        setAudioDuration(audio.duration || 0);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEnded) onEnded();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [duration, onEnded]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    audio.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleWaveformClick = (e) => {
    if (!waveformRef.current || !audioRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    const newTime = ratio * (audioDuration || 1);

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleMouseMove = (e) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(e.clientX - rect.left, rect.width)) / rect.width;
    setHoverProgress(ratio);
  };

  const handleMouseLeave = () => {
    setHoverProgress(null);
  };

  const progressRatio = audioDuration > 0 ? currentTime / audioDuration : 0;
  const numBars = peaks.length > 0 ? peaks.length : 80;

  return (
    <div className="w-full bg-bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-3.5 select-none shadow-soft">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Main Waveform Canvas Row */}
      <div
        ref={waveformRef}
        onClick={handleWaveformClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-16 sm:h-20 flex items-center cursor-pointer bg-bg-secondary/40 px-2 rounded-lg border border-border-subtle overflow-hidden"
        title="Click to seek playback position"
      >
        {/* Playhead Vertical Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-brand-terracotta z-20 pointer-events-none transition-all duration-75"
          style={{ left: `${progressRatio * 100}%` }}
        />

        {/* Hover Cue */}
        {hoverProgress !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-brand-caramel/60 z-10 pointer-events-none"
            style={{ left: `${hoverProgress * 100}%` }}
          />
        )}

        {/* Vertical Amplitude Bars */}
        <div className="w-full h-full flex items-center justify-between gap-[2px]">
          {Array.from({ length: numBars }).map((_, i) => {
            const barRatio = i / numBars;
            const isPlayed = barRatio <= progressRatio;
            const peakVal = peaks[i] !== undefined ? peaks[i] : 0.35 + 0.5 * Math.sin(i * 0.15);
            const heightPct = Math.round(Math.max(14, peakVal * 88));

            return (
              <div
                key={i}
                className={`flex-1 rounded-[1px] transition-colors duration-75 ${
                  isPlayed ? 'bg-brand-terracotta' : 'bg-border-subtle'
                }`}
                style={{ height: `${heightPct}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Media Controls & Timeline Bar */}
      <div className="flex items-center justify-between pt-1 text-xs text-espresso-secondary font-mono">
        <div className="flex items-center space-x-2.5">
          {/* Play / Pause Button (Terracotta) */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface flex items-center justify-center transition-all focus-visible:outline-none shadow-soft"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Replay Button */}
          <button
            type="button"
            onClick={handleRestart}
            className="p-1.5 text-espresso-secondary hover:text-espresso hover:bg-bg-secondary rounded transition-colors"
            title="Restart playback"
            aria-label="Restart audio from beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 text-espresso-secondary hover:text-espresso hover:bg-bg-secondary rounded transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-spoof" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Timestamp Indicator */}
        <div className="text-espresso-secondary font-mono text-[11px]">
          <span className="font-semibold text-espresso">{formatTime(currentTime)}</span>
          <span className="text-espresso-muted mx-1">/</span>
          <span>{formatTime(audioDuration)}</span>
        </div>
      </div>
    </div>
  );
}
