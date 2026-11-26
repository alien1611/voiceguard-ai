import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(os.tmpdir(), 'voiceguard_chrome_debug');
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
        } else if (msg.method === 'Log.entryAdded') {
          console.log('[BROWSER LOG]', msg.params.entry);
        } else if (msg.method === 'Network.responseReceived') {
          console.log('[BROWSER NETWORK RESPONSE]', msg.params.response.url, msg.params.response.status);
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

async function debug() {
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
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

  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');

  // Let's test calling predictVoice directly from page context:
  console.log('[DEBUG] Testing fetch(/api/predict) directly inside Chrome JavaScript context:');
  const directFetchResult = await client.eval(`
    (async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/health');
        return await res.json();
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()
  `);
  console.log('[DEBUG] Health in Chrome:', directFetchResult);

  // Now test predict with a small WAV blob inside Chrome context:
  const predictInChromeResult = await client.eval(`
    (async () => {
      try {
        const wavBytes = new Uint8Array(44 + 32000); // 1 sec silence
        // RIFF header
        const view = new DataView(wavBytes.buffer);
        view.setUint32(0, 0x46464952, true); // RIFF
        view.setUint32(4, 36 + 32000, true);
        view.setUint32(8, 0x45564157, true); // WAVE
        view.setUint32(12, 0x20746d66, true); // fmt 
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, 16000, true); // 16kHz
        view.setUint32(28, 32000, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x61746164, true); // data
        view.setUint32(40, 32000, true);

        const blob = new Blob([wavBytes], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', blob, 'test_chrome.wav');

        const res = await fetch('http://127.0.0.1:8000/api/predict', {
          method: 'POST',
          body: formData,
        });
        return { status: res.status, body: await res.json() };
      } catch (err) {
        return { error: err.message };
      }
    })()
  `);
  console.log('[DEBUG] Predict in Chrome:', predictInChromeResult);

  // Now check microphone recording inside Chrome context:
  console.log('[DEBUG] Testing getUserMedia in Chrome:');
  const micStreamTest = await client.eval(`
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const tracks = stream.getAudioTracks();
        return { trackCount: tracks.length, label: tracks[0]?.label, readyState: tracks[0]?.readyState };
      } catch (err) {
        return { error: err.message, name: err.name };
      }
    })()
  `);
  console.log('[DEBUG] Mic Stream in Chrome:', micStreamTest);

  // Now let's see why the UI button in Audit 4 and Audit 5 failed:
  // Let's check the DOM of the active tab:
  const domContent = await client.eval(`
    (() => {
      const activeTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Voice Analysis'));
      if (activeTabBtn) activeTabBtn.click();
      return document.querySelector('main')?.innerHTML?.substring(0, 500);
    })()
  `);
  console.log('[DEBUG] Main HTML after tab click:', domContent);

  chromeProcess.kill();
  process.exit(0);
}

debug().catch(console.error);
