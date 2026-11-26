/**
 * VoiceGuard Audio WAV PCM Encoder
 * ================================
 * Pure client-side lossless 16-bit linear PCM WAV encoder.
 * Encodes Float32Array audio sample chunks into a valid standard RIFF/WAVE Blob.
 * Strictly in-memory, zero dependencies, zero network transmission.
 */

/**
 * Encodes 1-D or array of Float32Array PCM samples into an audio/wav Blob.
 * @param {Float32Array|Float32Array[]} samples Input audio samples normalized in [-1.0, 1.0]
 * @param {number} sampleRate Sample rate in Hz (e.g. 16000, 22050, 44100)
 * @param {number} [numChannels=1] Number of audio channels (defaults to 1 = mono)
 * @returns {Blob} Standard RIFF 16-bit PCM WAV Blob
 */
export function encodeWav(samples, sampleRate = 16000, numChannels = 1) {
  // If array of Float32Array chunks, flatten into a single Float32Array
  let flatSamples;
  if (Array.isArray(samples)) {
    const totalLength = samples.reduce((acc, chunk) => acc + chunk.length, 0);
    flatSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of samples) {
      flatSamples.set(chunk, offset);
      offset += chunk.length;
    }
  } else if (samples instanceof Float32Array) {
    flatSamples = samples;
  } else {
    throw new TypeError('Samples must be a Float32Array or array of Float32Arrays');
  }

  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = flatSamples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII string to DataView
  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length (36 + dataSize) */
  view.setUint32(4, 36 + dataSize, true);
  /* RIFF type & format header */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length (16 for PCM) */
  view.setUint32(16, 16, true);
  /* sample format (1 = PCM) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * blockAlign) */
  view.setUint32(28, byteRate, true);
  /* block align (numChannels * bytesPerSample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, dataSize, true);

  // Write 16-bit PCM samples with clipping protection
  let offset = 44;
  for (let i = 0; i < flatSamples.length; i++) {
    // Clamp sample between -1.0 and 1.0
    const s = Math.max(-1, Math.min(1, flatSamples[i]));
    // Convert to signed 16-bit integer: [-32768, 32767]
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, Math.round(val), true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Resample a Float32Array from sourceSampleRate to targetSampleRate using linear interpolation.
 * @param {Float32Array} inputData
 * @param {number} sourceSampleRate
 * @param {number} targetSampleRate
 * @returns {Float32Array}
 */
export function resampleAudio(inputData, sourceSampleRate, targetSampleRate) {
  if (sourceSampleRate === targetSampleRate) {
    return inputData;
  }
  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(inputData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const origPos = i * ratio;
    const index = Math.floor(origPos);
    const frac = origPos - index;

    const s0 = inputData[index] || 0;
    const s1 = inputData[Math.min(index + 1, inputData.length - 1)] || 0;
    result[i] = s0 + frac * (s1 - s0);
  }

  return result;
}
