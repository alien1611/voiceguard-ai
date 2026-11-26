import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(os.tmpdir(), 'voiceguard_chrome_file_test');
const TTS_MP3 = process.env.TEST_MP3_PATH || path.resolve('test_sample.wav');

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
        if (msg.id && this.callbacks.has(msg.id)) {
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

async function testFileUpload() {
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1280,800',
    '--disable-gpu',
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

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Switch to Voice Analysis tab
  await client.eval(`
    const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch Voice Analysis') || b.textContent.includes('Voice Analysis'));
    if (tab) tab.click();
  `);
  await sleep(600);

  const mp3Buffer = fs.readFileSync(TTS_MP3);
  const mp3Base64 = mp3Buffer.toString('base64');

  const selectionResult = await client.eval(`
    (() => {
      const b64 = '${mp3Base64}';
      const byteCharacters = atob(b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'mira_tts.mp3', { type: 'audio/mpeg' });

      const input = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(file);
      
      delete input._valueTracker;
      input.files = dt.files;
      
      // Dispatch change event to React
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', { writable: false, value: input });
      input.dispatchEvent(event);

      return {
        inputFilesCount: input.files.length,
        fileName: input.files[0]?.name
      };
    })()
  `);
  console.log('Selection result:', selectionResult);
  await sleep(800);

  // Check if file card rendered
  const bodyText = await client.eval('document.body.innerText');
  console.log('Does body have Analyze Audio Recording?', bodyText.includes('Analyze Audio Recording'));
  console.log('Does body have mira_tts.mp3?', bodyText.includes('mira_tts.mp3'));

  if (bodyText.includes('Analyze Audio Recording')) {
    console.log('Clicking Analyze Audio Recording button...');
    await client.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Audio Recording'));
      if (btn) btn.click();
    `);

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const res = await client.eval('document.body.innerText');
      if (res.toUpperCase().includes('CONFIDENCE SCORE')) {
        console.log('Prediction SUCCESS! Found Confidence Score in DOM:');
        const lines = res.split('\n').filter(l => l.includes('SPOOF') || l.includes('Confidence') || l.includes('Likelihood'));
        console.log(lines.join(' | '));
        break;
      }
    }
  }

  if (client.ws) client.ws.close();
  chromeProcess.kill();
  process.exit(0);
}

testFileUpload().catch(console.error);
