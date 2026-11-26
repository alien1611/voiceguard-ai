import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileAudio, 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Sparkles,
  Music,
  Sliders,
  Disc
} from 'lucide-react';
import WaveformPlayer from './WaveformPlayer';
import { extractWaveformPeaks } from '../utils/waveform';
import { formatBytes, formatTime } from '../utils/formatters';

const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.flac', '.ogg'];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export default function FileUploader({
  onAnalyze,
  isAnalyzing,
  error,
  onClearError,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [waveformPeaks, setWaveformPeaks] = useState([]);
  const [fileDuration, setFileDuration] = useState(null);
  const [isDecodingWaveform, setIsDecodingWaveform] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const validateFile = (file) => {
    setValidationError(null);
    if (onClearError) onClearError();

    if (!file) return false;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(`File size (${formatBytes(file.size)}) exceeds the maximum allowed 25 MB limit.`);
      return false;
    }

    const name = file.name.toLowerCase();
    const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!hasValidExt) {
      setValidationError('Unsupported format. Please upload a WAV, MP3, FLAC, or OGG file.');
      return false;
    }

    return true;
  };

  const handleFileSelection = async (file) => {
    if (!validateFile(file)) {
      clearSelection();
      return;
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    const newUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setAudioUrl(newUrl);

    // Decode audio waveform client-side for visual preview
    setIsDecodingWaveform(true);
    try {
      const { peaks, duration } = await extractWaveformPeaks(file, 96);
      setWaveformPeaks(peaks);
      if (duration) {
        setFileDuration(duration);
      }
    } catch {
      // Fallback
    } finally {
      setIsDecodingWaveform(false);
    }
  };

  const clearSelection = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setSelectedFile(null);
    setAudioUrl(null);
    setWaveformPeaks([]);
    setFileDuration(null);
    setValidationError(null);
    if (onClearError) onClearError();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleTriggerAnalyze = () => {
    if (!selectedFile || isAnalyzing) return;
    onAnalyze(selectedFile, selectedFile.name);
  };

  const activeError = validationError || error;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.flac,.ogg"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelection(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Validation or Processing Error */}
      {activeError && (
        <div className="p-4 bg-spoof-bg border border-spoof-border text-spoof rounded-lg flex items-start space-x-3 text-xs shadow-soft">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold text-espresso">Ingestion Notice: </span>
            <span>{activeError}</span>
          </div>
          <button
            onClick={() => {
              setValidationError(null);
              if (onClearError) onClearError();
            }}
            className="text-spoof hover:opacity-75"
            aria-label="Dismiss error notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!selectedFile ? (
        /* REFINED UPLOAD AREA: Open composition, warm minimalist layout */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`apple-dropzone border-2 border-dashed rounded-xl p-10 sm:p-14 text-center cursor-pointer bg-bg-surface ${
            isDragging
              ? 'border-brand-terracotta bg-brand-terracotta-subtle/60'
              : 'border-border-subtle hover:border-brand-terracotta/70 hover:bg-bg-secondary/30'
          }`}
        >
          <div className="max-w-md mx-auto flex flex-col items-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-brand-primary-subtle border border-border-subtle flex items-center justify-center text-brand-primary shadow-soft">
              <Upload className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <p className="font-serif font-bold text-lg text-espresso">
                Drag and drop speech audio, or{' '}
                <span className="text-brand-terracotta underline underline-offset-4 decoration-brand-terracotta/40">browse files</span>
              </p>
              <p className="text-xs text-espresso-secondary">
                Lossless in-memory decoding &bull; Max 25 MB &bull; Evaluated on 64k aperture
              </p>
            </div>

            {/* Container Format Chips */}
            <div className="flex items-center space-x-2 pt-1">
              {['WAV', 'MP3', 'FLAC', 'OGG'].map((fmt) => (
                <span
                  key={fmt}
                  className="px-2.5 py-1 rounded text-[10px] font-mono font-medium bg-bg-secondary text-espresso border border-border-subtle shadow-soft"
                >
                  {fmt}
                </span>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-deep text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft uppercase tracking-wider"
              >
                Select Audio File
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* AFTER FILE SELECTION: Full Audio Inspection Surface */
        <div className="space-y-6">
          {/* File Meta Header Bar */}
          <div className="apple-card flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-bg-secondary/40 border border-border-subtle rounded-xl gap-4">
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center text-brand-primary shrink-0 shadow-soft">
                <FileAudio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-serif font-bold text-base text-espresso truncate max-w-sm sm:max-w-md">
                  {selectedFile.name}
                </p>
                <div className="flex items-center space-x-2 text-[11px] text-espresso-secondary font-mono mt-0.5">
                  <span>{formatBytes(selectedFile.size)}</span>
                  <span>&bull;</span>
                  <span className="uppercase font-semibold text-brand-terracotta">
                    {selectedFile.name.split('.').pop()}
                  </span>
                  {fileDuration && (
                    <>
                      <span>&bull;</span>
                      <span>{formatTime(fileDuration)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="px-3 py-1.5 text-xs text-espresso-secondary hover:text-espresso hover:bg-bg-surface rounded-md border border-border-subtle transition-all disabled:opacity-50"
              >
                Change
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={isAnalyzing}
                className="p-1.5 text-espresso-secondary hover:text-espresso hover:bg-bg-surface rounded-md border border-border-subtle transition-all disabled:opacity-50"
                title="Remove file"
                aria-label="Remove selected audio file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Waveform Player */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono font-semibold text-espresso uppercase tracking-wider flex items-center space-x-2">
                <Disc className="w-3.5 h-3.5 text-brand-terracotta" />
                <span>Acoustic Waveform Preview</span>
              </span>
              {isDecodingWaveform && (
                <span className="text-[11px] text-espresso-secondary flex items-center space-x-1.5 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-brand-terracotta" />
                  <span>Decoding signal...</span>
                </span>
              )}
            </div>
            <WaveformPlayer
              audioUrl={audioUrl}
              peaks={waveformPeaks}
              duration={fileDuration}
            />
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-border-subtle">
            <span className="text-xs text-espresso-secondary font-mono">
              Inference Aperture: 4.00s @ 16,000 Hz Mono (64,000 samples)
            </span>

            <button
              type="button"
              data-testid="verify-submit-btn"
              onClick={handleTriggerAnalyze}
              disabled={isAnalyzing}
              className="inline-flex items-center justify-center space-x-2.5 px-7 py-3 bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface text-xs font-semibold uppercase tracking-wider rounded-md transition-all shadow-soft disabled:opacity-60"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting Micro-Acoustics...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Execute Verification</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
