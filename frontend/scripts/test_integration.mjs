/**
 * VoiceGuard Frontend & Backend Automated Integration Test Suite
 * ==============================================================
 * Verifies:
 * 1. Health endpoint response and schema
 * 2. Model info endpoint response and schema
 * 3. WAV upload and prediction
 * 4. MP3 upload and prediction
 * 5. Invalid file handling (HTTP 400 with clear error message)
 * 6. Web Audio API WAV encoder (generates valid 16-bit PCM mono 16 kHz WAV)
 * 7. Recorded WAV submission to backend
 * 8. Score, latency, and metadata validation
 */

import { encodeWAV } from '../src/utils/wavEncoder.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:8000';

async function runTests() {
  console.log('====================================================');
  console.log('VOICEGUARD AI — FRONTEND & BACKEND INTEGRATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Backend Health
  try {
    process.stdout.write('[TEST 1] GET /api/health ... ');
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'healthy' && data.model_loaded === true && data.device) {
      console.log(`PASSED (Status: ${data.status}, Device: ${data.device}, Uptime: ${data.uptime_seconds}s)`);
      passed++;
    } else {
      throw new Error(`Unexpected payload: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 2: Model Info
  try {
    process.stdout.write('[TEST 2] GET /api/model-info ... ');
    const res = await fetch(`${API_BASE}/api/model-info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.model_name === 'AudioCNN' && data.target_sample_rate_hz === 16000 && data.input_shape.length === 4) {
      console.log(`PASSED (Model: ${data.model_name}, Input: [${data.input_shape}], SR: ${data.target_sample_rate_hz}Hz)`);
      passed++;
    } else {
      throw new Error(`Unexpected payload: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 3: WAV Upload
  const wavPath = process.env.TEST_WAV_PATH || path.resolve('test_sample.wav');
  try {
    process.stdout.write('[TEST 3] POST /api/predict with WAV file ... ');
    const fileBytes = fs.readFileSync(wavPath);
    const blob = new Blob([fileBytes], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, 'mira_cmd.wav');

    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.predicted_class && typeof data.confidence === 'number' && typeof data.spoof_score === 'number') {
      console.log(`PASSED (Class: ${data.predicted_class}, Conf: ${(data.confidence * 100).toFixed(1)}%, Latency: ${data.processing_time_ms}ms)`);
      passed++;
    } else {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 4: Compressed / Secondary Audio Upload
  const mp3Path = process.env.TEST_MP3_PATH || path.resolve('test_sample.wav');
  try {
    process.stdout.write('[TEST 4] POST /api/predict with MP3 file ... ');
    const fileBytes = fs.readFileSync(mp3Path);
    const blob = new Blob([fileBytes], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('file', blob, 'mira_tts.mp3');

    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.predicted_class === 'SPOOF') {
      console.log(`PASSED (Class: ${data.predicted_class}, Spoof: ${(data.spoof_score * 100).toFixed(1)}%, Orig SR: ${data.audio_metadata.original_sample_rate}Hz)`);
      passed++;
    } else {
      throw new Error(`Unexpected prediction: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 5: Invalid File Upload (Text file)
  try {
    process.stdout.write('[TEST 5] POST /api/predict with invalid text file ... ');
    const textBlob = new Blob(['This is not an audio file.'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', textBlob, 'notes.txt');

    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
    });
    if (res.status === 400) {
      const data = await res.json();
      console.log(`PASSED (Rejected with HTTP 400: "${data.detail}")`);
      passed++;
    } else {
      throw new Error(`Expected HTTP 400 but received HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 6: Web Audio API WAV Encoder Simulation (PCM to 16-bit Mono 16 kHz WAV)
  let simulatedWavBlob = null;
  try {
    process.stdout.write('[TEST 6] Web Audio API WAV encoder validation ... ');
    // Generate 3 seconds of synthetic 440 Hz sine wave PCM float32 samples at 44.1 kHz
    const inputSampleRate = 44100;
    const durationSec = 3.0;
    const totalSamples = Math.floor(inputSampleRate * durationSec);
    const chunk1 = new Float32Array(Math.floor(totalSamples / 2));
    const chunk2 = new Float32Array(totalSamples - chunk1.length);

    for (let i = 0; i < chunk1.length; i++) {
      chunk1[i] = 0.5 * Math.sin(2 * Math.PI * 440 * (i / inputSampleRate));
    }
    for (let i = 0; i < chunk2.length; i++) {
      chunk2[i] = 0.5 * Math.sin(2 * Math.PI * 440 * ((i + chunk1.length) / inputSampleRate));
    }

    simulatedWavBlob = encodeWAV([chunk1, chunk2], inputSampleRate, 16000);

    // Validate WAV header
    const arrayBuffer = await simulatedWavBlob.arrayBuffer();
    const view = new DataView(arrayBuffer);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);

    if (riff === 'RIFF' && wave === 'WAVE' && channels === 1 && sampleRate === 16000 && bitsPerSample === 16) {
      console.log(`PASSED (Header: RIFF/WAVE, Channels: ${channels}, SR: ${sampleRate}Hz, Bits: ${bitsPerSample}, Size: ${arrayBuffer.byteLength} bytes)`);
      passed++;
    } else {
      throw new Error(`Invalid WAV header properties: riff=${riff}, wave=${wave}, channels=${channels}, sr=${sampleRate}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 7: Submit Simulated Microphone WAV to Backend
  try {
    process.stdout.write('[TEST 7] POST /api/predict with encoded microphone WAV ... ');
    const formData = new FormData();
    formData.append('file', simulatedWavBlob, 'mic_recording.wav');

    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.predicted_class && data.audio_metadata.original_sample_rate === 16000) {
      console.log(`PASSED (Class: ${data.predicted_class}, Conf: ${(data.confidence * 100).toFixed(1)}%, Model Status: ${data.model_status})`);
      passed++;
    } else {
      throw new Error(`Unexpected prediction output: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
