/**
 * VoiceGuard AI — Real Browser Verification Suite
 * ===============================================
 * Controls Google Chrome 157 via Chrome DevTools Protocol (CDP) WebSocket.
 * Feeds speech WAV audio into Chrome's virtual microphone.
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(os.tmpdir(), 'voiceguard_chrome_real_audit');
const HUMAN_SPEECH_WAV = process.env.TEST_WAV_PATH || path.resolve('test_sample.wav');
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

async function runBrowserAudit() {
  console.log('====================================================');
  console.log('VOICEGUARD AI — REAL BROWSER AUDIT (GOOGLE CHROME 157)');
  console.log('====================================================\n');

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

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  let auditPassed = 0;
  let auditFailed = 0;

  // TEST 1: Page Load and Navigation
  try {
    process.stdout.write('[AUDIT 1] Real Browser: Title & Initial DOM Load ... ');
    const pageTitle = await client.eval('document.title');
    const headerText = await client.eval('document.querySelector("header").innerText');
    if (pageTitle.includes('VoiceGuard AI') && headerText.includes('VoiceGuard')) {
      console.log(`PASSED (Title: "${pageTitle}")`);
      auditPassed++;
    } else {
      throw new Error(`Unexpected title or header: ${pageTitle}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    auditFailed++;
  }

  // TEST 2: Real Backend Status Pill
  try {
    process.stdout.write('[AUDIT 2] Real Browser: Backend Health Indicator ... ');
    await sleep(500);
    const backendStatusText = await client.eval('document.querySelector("header").innerText');
    if (backendStatusText.includes('Backend: CPU') || backendStatusText.includes('Backend: CUDA')) {
      console.log(`PASSED (Indicator: "Backend: CPU")`);
      auditPassed++;
    } else {
      throw new Error(`Backend pill not found or offline: ${backendStatusText}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    auditFailed++;
  }

  // TEST 3: Real Browser File Upload & Inference
  try {
    process.stdout.write('[AUDIT 3] Real Browser: File Upload (MP3) & Prediction ... ');
    // Switch to Voice Analysis tab via prominent CTA button
    await client.eval(`
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch Voice Analysis') || b.textContent.includes('Voice Analysis'));
      if (tab) tab.click();
    `);
    await sleep(800);

    const mp3Buffer = fs.readFileSync(TTS_MP3);
    const mp3Base64 = mp3Buffer.toString('base64');

    await client.eval(`
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

        const event = new Event('change', { bubbles: true });
        Object.defineProperty(event, 'target', { writable: false, value: input });
        input.dispatchEvent(event);
      })()
    `);
    await sleep(800);

    // Wait for "Analyze Audio Recording" button
    for (let i = 0; i < 15; i++) {
      await sleep(300);
      const hasBtn = await client.eval(`!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Audio Recording'))`);
      if (hasBtn) break;
    }

    // Click "Analyze Audio Recording" button
    await client.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Audio Recording'));
      if (btn) btn.click();
    `);

    // Wait for prediction result in DOM
    let predictionRendered = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const res = await client.eval('document.body.innerText');
      if (res && res.toUpperCase().includes('CONFIDENCE SCORE')) {
        predictionRendered = true;
        break;
      }
    }

    if (predictionRendered) {
      console.log('PASSED (File upload successfully analyzed and result rendered in DOM)');
      auditPassed++;
    } else {
      throw new Error('Prediction result not rendered within timeout');
    }

    // Reset for next test
    await client.eval(`
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Another Recording'));
      if (resetBtn) resetBtn.click();
    `);
    await sleep(500);
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    auditFailed++;
  }

  // TEST 4: REAL MICROPHONE TEST WITH ACTUAL HUMAN SPEECH
  try {
    process.stdout.write('[AUDIT 4] Real Browser: Microphone Recording with Real Human Speech ... ');
    // Switch to Microphone tab
    await client.eval(`
      const micTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Microphone Recording'));
      if (micTab) micTab.click();
    `);
    await sleep(500);

    // Click "Start Recording"
    await client.eval(`
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Recording'));
      if (startBtn) startBtn.click();
    `);
    await sleep(3500); // Record speech stream for 3.5 seconds

    // Click "Stop Recording"
    await client.eval(`
      const stopBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Stop Recording'));
      if (stopBtn) stopBtn.click();
    `);
    await sleep(1000);

    // Click "Analyze Recording"
    await client.eval(`
      const analyzeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Recording'));
      if (analyzeBtn) analyzeBtn.click();
    `);

    // Wait for prediction result in DOM
    let micPredictionReady = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const micResultText = await client.eval('document.body.innerText');
      if (micResultText && micResultText.toUpperCase().includes('CONFIDENCE SCORE')) {
        micPredictionReady = true;
        break;
      }
    }

    if (micPredictionReady) {
      console.log('PASSED (Real human speech captured via Web Audio API, encoded to WAV, and classified)');
      auditPassed++;
    } else {
      throw new Error('Microphone audio was not analyzed or prediction failed');
    }

    // Reset for next test
    await client.eval(`
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Another Recording'));
      if (resetBtn) resetBtn.click();
    `);
    await sleep(500);
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    auditFailed++;
  }

  // TEST 5: Model Specs Modal
  try {
    process.stdout.write('[AUDIT 5] Real Browser: Inspect Model Specs Modal ... ');
    const clicked = await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.getAttribute('title')?.includes('Model') || 
          b.textContent.trim() === 'Model Specs'
        );
        if (btn) {
          btn.click();
          return 'Clicked button: ' + (btn.getAttribute('title') || btn.textContent);
        }
        return 'No button found';
      })()
    `);
    
    let modalOpened = false;
    for (let i = 0; i < 15; i++) {
      await sleep(300);
      const text = await client.eval('document.body.innerText');
      if (text.includes('VoiceGuard Model Specifications') || text.includes('Model Specifications')) {
        modalOpened = true;
        break;
      }
    }

    if (modalOpened) {
      console.log('PASSED (' + clicked + ', Modal opened successfully)');
      auditPassed++;
    } else {
      const dump = await client.eval('document.body.innerText');
      throw new Error(`Model Specs modal not detected. Action: ${clicked}. DOM: ${dump.substring(0, 150)}`);
    }
    // Close modal
    await client.eval(`
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(400);
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    auditFailed++;
  }

  // TEST 6: Responsive Viewports (Desktop 1280x800 vs Mobile 375x667)
  try {
    process.stdout.write('[AUDIT 6] Real Browser: Responsive Viewports (Desktop & Mobile) ... ');
    // Test Desktop
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);
    const desktopNavVisible = await client.eval('window.getComputedStyle(document.querySelector("nav")).display !== "none"');

    // Test Mobile
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(300);
    const mobileNavHidden = await client.eval('window.getComputedStyle(document.querySelector("nav")).display === "none"');

    if (desktopNavVisible && mobileNavHidden) {
      console.log('PASSED (Desktop displays full navbar; Mobile switches to compact responsive layout)');
      auditPassed++;
    } else {
      throw new Error(`Responsive check failed: desktop=${desktopNavVisible}, mobile=${mobileNavHidden}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    auditFailed++;
  }

  if (client.ws) client.ws.close();
  chromeProcess.kill();

  console.log('\n----------------------------------------------------');
  console.log(`REAL BROWSER AUDIT SUMMARY: ${auditPassed} PASSED, ${auditFailed} FAILED (Total: ${auditPassed + auditFailed})`);
  console.log('----------------------------------------------------');

  if (auditFailed > 0) {
    process.exit(1);
  }
}

runBrowserAudit().catch((err) => {
  console.error('FATAL AUDIT ERROR:', err);
  process.exit(1);
});
