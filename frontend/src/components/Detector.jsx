import React, { useState } from 'react';
import { AlertCircle, Waves, Sparkles } from 'lucide-react';
import FileUploader from './FileUploader';
import ResultDisplay from './ResultDisplay';
import { predictVoice } from '../services/api';

export default function Detector({ backendHealth }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isHealthy = backendHealth?.status === 'healthy';

  const handleAnalyze = async (audioPayload, filename) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await predictVoice(audioPayload, filename, 'upload');
      setResult(response);
    } catch (err) {
      setError(err.message || 'An error occurred during audio inference.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Heading & Supporting Editorial Copy */}
      <div className="space-y-1.5">
        <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-widest text-brand-terracotta font-semibold">
          <Waves className="w-3.5 h-3.5" />
          <span>Acoustic Verification Suite</span>
        </div>
        <h2 className="editorial-display text-2xl sm:text-3xl font-bold text-espresso tracking-tight">
          Verify Audio Recording
        </h2>
        <p className="text-sm text-espresso-secondary max-w-2xl leading-relaxed">
          Upload speech recordings to inspect phase inconsistencies, high-frequency spectral envelope anomalies, and neural vocoder artifacts.
        </p>
      </div>

      {/* Backend Offline Warning Banner */}
      {!isHealthy && (
        <div className="p-4 rounded-lg bg-warning-bg border border-warning-border text-xs text-warning flex items-start space-x-3 shadow-soft">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-espresso">Inference Engine Offline</p>
            <p className="text-espresso-secondary">
              Cannot establish connection to the local VoiceGuard backend server. Ensure the service is running on port 8000.
            </p>
          </div>
        </div>
      )}

      {/* Verification Workspace Surface */}
      <div className="bg-bg-surface rounded-xl border border-border-subtle p-7 sm:p-9 shadow-card">
        {result ? (
          <ResultDisplay result={result} onReset={handleReset} />
        ) : (
          <FileUploader
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            error={error}
            onClearError={() => setError(null)}
          />
        )}
      </div>
    </div>
  );
}
