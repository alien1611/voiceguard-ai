import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(os.tmpdir(), 'voiceguard_chrome_mic_test');
const HUMAN_SPEECH_WAV = process.env.TEST_WAV_PATH || path.resolve('test_sample.wav');

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
        } else if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }
}

async function getBrowserTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runRealMicTest() {
  console.log('========================================================');
  console.log('VOICEGUARD AI — REAL BROWSER MICROPHONE TEST (CHROME 157)');
  console.log('========================================================\n');

  console.log(`[CONFIG] Feeding actual human speech: ${HUMAN_SPEECH_WAV}`);

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1280,800',
    '--disable-gpu',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${HUMAN_SPEECH_WAV}`,
    'http://127.0.0.1:5173',
  ]);

  await sleep(2000);
  const targets = await getBrowserTargets();
  const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('5173'));
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  // Set desktop viewport
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Step 1: Open Frontend & Navigate to Detector
  console.log('[STEP 1] Navigating to Voice Analysis in real browser...');
  await client.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch Voice Analysis') || b.textContent.includes('Voice Analysis'));
    if (btn) btn.click();
  `);
  await sleep(600);

  // Step 2: Switch to Microphone Tab
  console.log('[STEP 2] Switching to Microphone Recording tab...');
  await client.eval(`
    const micTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Microphone Recording'));
    if (micTab) micTab.click();
  `);
  await sleep(600);

  // Step 3: Grant Permission & Start Recording
  console.log('[STEP 3] Triggering Start Recording (Browser getUserMedia with human speech)...');
  const startResult = await client.eval(`
    (() => {
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Recording'));
      if (!startBtn) return 'Start button not found';
      startBtn.click();
      return 'Clicked start';
    })()
  `);
  console.log('         Start button action:', startResult);

  // Wait 1 second and check if recording is active
  await sleep(1000);
  const activeStatus = await client.eval(`
    document.body.innerText.includes('Recording active')
  `);
  console.log('         Recording active indicator in DOM:', activeStatus);

  // Step 4: Record for 4.0 seconds
  console.log('[STEP 4] Recording live microphone speech stream (4.0 seconds)...');
  for (let s = 1; s <= 4; s++) {
    await sleep(1000);
    const timerText = await client.eval(`
      document.querySelector('.text-3xl')?.innerText || 'timer'
    `);
    console.log(`         Recording in progress: ${timerText} elapsed`);
  }

  // Step 5: Stop Recording & Verify WAV compilation
  console.log('[STEP 5] Clicking Stop Recording & compiling PCM to WAV...');
  await client.eval(`
    const stopBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Stop Recording'));
    if (stopBtn) stopBtn.click();
  `);
  await sleep(1500);

  const captureStatus = await client.eval(`
    (() => {
      const text = document.body.innerText;
      const audioEl = document.querySelector('audio');
      return {
        captured: text.includes('Recording Captured') || text.includes('recorded_voice.wav'),
        audioSrc: audioEl?.src,
        bodyTextSnippet: text.substring(0, 300)
      };
    })()
  `);
  console.log('         Captured status:', captureStatus.captured);
  console.log('         Audio preview source:', captureStatus.audioSrc);

  // Step 6: Verify WAV blob in browser memory
  console.log('[STEP 6] Inspecting generated WAV blob in browser context...');
  const wavInfo = await client.eval(`
    (async () => {
      const audioEl = document.querySelector('audio');
      if (!audioEl || !audioEl.src) return { error: 'No audio element src' };
      const res = await fetch(audioEl.src);
      const buffer = await res.arrayBuffer();
      const view = new DataView(buffer);
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      const channels = view.getUint16(22, true);
      const sampleRate = view.getUint32(24, true);
      const bits = view.getUint16(34, true);
      return {
        riff,
        wave,
        channels,
        sampleRate,
        bits,
        byteLength: buffer.byteLength,
        durationSeconds: (buffer.byteLength - 44) / (sampleRate * 2)
      };
    })()
  `);
  console.log('         WAV Verification:', wavInfo);

  // Step 7: Click "Analyze Recording" to submit to local backend
  console.log('[STEP 7] Submitting recorded WAV to local backend (POST /api/predict)...');
  await client.eval(`
    const analyzeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Recording'));
    if (analyzeBtn) analyzeBtn.click();
  `);

  // Step 8: Wait for real prediction result in DOM
  console.log('[STEP 8] Waiting for prediction response to render in UI...');
  let resultText = '';
  let succeeded = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    resultText = await client.eval('document.body.innerText');
    if (resultText && resultText.toUpperCase().includes('CONFIDENCE SCORE')) {
      succeeded = true;
      break;
    }
  }

  if (succeeded) {
    console.log('\n========================================================');
    console.log('REAL BROWSER MICROPHONE TEST PASSED SUCCESSFULLY!');
    console.log('========================================================\n');
    const lines = resultText.split('\n').filter(l => 
      l.toUpperCase().includes('CLASSIFICATION') || 
      l.includes('BONAFIDE') || 
      l.includes('SPOOF') || 
      l.toUpperCase().includes('CONFIDENCE') ||
      l.includes('Bonafide Likelihood') ||
      l.includes('Spoof Likelihood') ||
      l.includes('Inference Latency')
    );
    console.log('Extracted DOM Result Fields:');
    lines.forEach(l => console.log('  • ' + l.trim()));
  } else {
    console.error('FAILED: Prediction did not appear in DOM within timeout.');
    console.error('DOM Content was:\n', resultText.substring(0, 500));
  }

  if (client.ws) client.ws.close();
  chromeProcess.kill();

  if (!succeeded) {
    process.exit(1);
  }
}

runRealMicTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
