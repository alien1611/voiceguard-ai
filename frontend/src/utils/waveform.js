/**
 * VoiceGuard Waveform Extractor
 * =============================
 * Extracts normalized peak amplitudes from an audio file entirely client-side
 * using the Web Audio API (AudioContext.decodeAudioData).
 * Strictly in-memory, zero network transmission.
 */

export async function extractWaveformPeaks(file, numBars = 96) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) {
      return generateFallbackPeaks(numBars);
    }

    const audioCtx = new AudioCtxClass();
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const channelData = audioBuffer.getChannelData(0);
      const totalSamples = channelData.length;
      const step = Math.floor(totalSamples / numBars);

      const peaks = [];
      let maxPeak = 0;

      for (let i = 0; i < numBars; i++) {
        const start = i * step;
        const end = Math.min(start + step, totalSamples);
        let sum = 0;
        let count = 0;

        for (let j = start; j < end; j += 4) {
          sum += Math.abs(channelData[j]);
          count++;
        }

        const avg = count > 0 ? sum / count : 0;
        peaks.push(avg);
        if (avg > maxPeak) maxPeak = avg;
      }

      // Normalize between 0.12 and 1.0
      const divisor = maxPeak > 0 ? maxPeak : 1;
      const normalized = peaks.map((p) => {
        const val = p / divisor;
        return Math.max(0.12, Math.min(1.0, val));
      });

      return {
        peaks: normalized,
        duration: audioBuffer.duration,
      };
    } finally {
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Waveform extraction fallback used:', err);
    return generateFallbackPeaks(numBars);
  }
}

function generateFallbackPeaks(numBars = 96) {
  const peaks = [];
  for (let i = 0; i < numBars; i++) {
    const envelope = Math.sin((i / numBars) * Math.PI);
    const jitter = 0.2 + 0.8 * Math.random();
    peaks.push(Math.max(0.15, Math.min(1.0, envelope * jitter)));
  }
  return {
    peaks,
    duration: null,
  };
}
