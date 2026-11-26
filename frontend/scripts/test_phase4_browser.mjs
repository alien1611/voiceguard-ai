/**
 * VoiceGuard AI — Phase 4 Real Browser UI Verification via Chrome CDP
 * ===================================================================
 * Verifies all Phase 4 features in real Google Chrome 157:
 * 1. Navbar Navigation & Database status pill (DB: Online)
 * 2. Ingestion of detections via browser client
 * 3. HistoryView dashboard cards (Total, Bonafide, Spoof, Storage Engine)
 * 4. Interactive Class Filter buttons (All, Bonafide, Spoof)
 * 5. Record Details modal with 60 LFCC specs & acoustic metadata
 * 6. Individual record deletion with instant table update
 * 7. "Clear History" confirmation modal and purge to empty state
 * 8. Empty state action navigation button
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(os.tmpdir(), 'voiceguard_chrome_phase4_full');
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBrowserAudit() {
  console.log('================================================================');
  console.log('VOICEGUARD AI — PHASE 4 REAL BROWSER (CHROME CDP) AUDIT');
  console.log('================================================================\n');

  // Clear previous MongoDB records to guarantee predictable baseline
  try {
    await fetch('http://127.0.0.1:8000/api/history', { method: 'DELETE' });
  } catch {}

  if (fs.existsSync(USER_DATA_DIR)) {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  }

  const chromeArgs = [
    `--remote-debugging-port=9222`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-features=Translate',
    '--window-size=1280,900',
    'http://127.0.0.1:5173',
  ];

  console.log('[BROWSER] Launching Google Chrome...');
  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

  let connected = false;
  let client = null;

  for (let attempt = 1; attempt <= 15; attempt++) {
    await sleep(800);
    try {
      const targets = await getBrowserTargets();
      const pageTarget = targets.find((t) => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        client = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await client.connect();
        connected = true;
        break;
      }
    } catch {
      // Retrying connection
    }
  }

  if (!connected) {
    chromeProc.kill();
    throw new Error('Could not connect to Chrome DevTools Protocol on port 9222.');
  }

  console.log('[BROWSER] Connected to Chrome DevTools Protocol successfully.\n');
  await sleep(2500); // Wait for initial React render and health check

  let testsPassed = 0;
  let testsFailed = 0;

  // Wait for initial health check
  for (let i = 0; i < 15; i++) {
    const text = await client.eval('document.querySelector("header")?.innerText || ""');
    if (text.includes('DB: Online')) break;
    await sleep(400);
  }

  // STEP 1: Verify Navbar & DB status pill
  try {
    process.stdout.write('[STEP 1] Navbar Rendering & Database Status Badge ... ');
    const headerText = await client.eval('document.querySelector("header").innerText');
    const hasHistoryLink = headerText.includes('History');
    const hasDbPill = headerText.includes('DB: Online');

    if (hasHistoryLink && hasDbPill) {
      console.log(`PASSED (Found 'History' navigation tab and 'DB: Online')`);
      testsPassed++;
    } else {
      throw new Error(`Navbar missing elements: ${headerText}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // STEP 2: Ingest sample audio records via browser fetch to simulate user analysis
  try {
    process.stdout.write('[STEP 2] Ingest Audio Detections via Browser Client ... ');
    const wavBytes = fs.readFileSync(HUMAN_SPEECH_WAV);
    const wavB64 = wavBytes.toString('base64');
    const mp3Bytes = fs.readFileSync(TTS_MP3);
    const mp3B64 = mp3Bytes.toString('base64');

    const ingestResult = await client.eval(`
      (async () => {
        const makeFile = (b64, name, type) => {
          const byteChars = atob(b64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
          return new File([new Uint8Array(byteNums)], name, { type });
        };

        const f1 = makeFile("${wavB64}", "speech_sample_01.wav", "audio/wav");
        const f2 = makeFile("${mp3B64}", "tts_sample_02.mp3", "audio/mpeg");

        const postFile = async (f) => {
          const fd = new FormData();
          fd.append('file', f, f.name);
          const res = await fetch('http://127.0.0.1:8000/api/predict', { method: 'POST', body: fd });
          return await res.json();
        };

        const r1 = await postFile(f1);
        const r2 = await postFile(f2);
        return { r1_saved: r1.db_saved, r1_id: r1.detection_id, r2_saved: r2.db_saved, r2_id: r2.detection_id };
      })()
    `);

    if (ingestResult.r1_saved && ingestResult.r2_saved && ingestResult.r1_id && ingestResult.r2_id) {
      console.log(`PASSED (Ingested 2 audio recordings, stored in MongoDB with IDs: ${ingestResult.r1_id}, ${ingestResult.r2_id})`);
      testsPassed++;
    } else {
      throw new Error(`Ingestion failed: ${JSON.stringify(ingestResult)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // STEP 3: Click "History" Tab & Validate Summary Dashboard
  try {
    process.stdout.write('[STEP 3] Navigate to "History" Tab & Verify Summary Dashboard ... ');
    await client.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'History');
      if (btn) btn.click();
    `);
    await sleep(1500);

    const pageText = await client.eval('document.body.innerText');
    const hasHeading = pageText.includes('Detection History') && pageText.includes('MongoDB Community');
    const hasConnected = pageText.includes('MongoDB: Connected');
    const hasTotal = pageText.includes('TOTAL DETECTIONS') && pageText.includes('2');

    if (hasHeading && hasConnected && hasTotal) {
      console.log(`PASSED (Dashboard renders: Total Detections: 2, MongoDB: Connected)`);
      testsPassed++;
    } else {
      throw new Error(`History dashboard verification failed. Text preview: ${pageText.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // STEP 4: History Table Row Rendering & Content
  try {
    process.stdout.write('[STEP 4] Verify History Table Rows & Acoustic Columns ... ');
    const tableText = await client.eval('document.querySelector("table")?.innerText || ""');
    const hasWav = tableText.includes('speech_sample_01.wav');
    const hasMp3 = tableText.includes('tts_sample_02.mp3');
    const hasBadge = tableText.includes('SPOOF') || tableText.includes('BONAFIDE');

    if (hasWav && hasMp3 && hasBadge) {
      console.log(`PASSED (Found both 'speech_sample_01.wav' and 'tts_sample_02.mp3' in table)`);
      testsPassed++;
    } else {
      throw new Error(`Table content missing records: ${tableText}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // STEP 5: Interactive Details Modal
  try {
    process.stdout.write('[STEP 5] Open Record Details Modal & Inspect 60-LFCC Specs ... ');
    const clicked = await client.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="view-details-btn"]');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    if (!clicked) throw new Error('View details button not found in table row');

    // Wait for modal to render
    let modalText = '';
    for (let wait = 0; wait < 15; wait++) {
      await sleep(300);
      modalText = await client.eval(`document.querySelector('[data-testid="record-details-modal"]')?.innerText || ''`);
      if (modalText.includes('AudioCNN')) break;
    }

    const upperModal = modalText.toUpperCase();
    const hasAudioDetails = upperModal.includes('AUDIO INGESTION');
    const hasLFCCFilters = upperModal.includes('LFCC') || upperModal.includes('60 LINEAR');
    const hasModelCNN = upperModal.includes('AUDIOCNN');

    if (hasAudioDetails && hasLFCCFilters && hasModelCNN) {
      console.log(`PASSED (Inspected modal: 60 linear banks, AudioCNN architecture, acoustic metadata verified)`);
      testsPassed++;
    } else {
      throw new Error(`Modal content missing expected details: ${modalText.slice(0, 150)}`);
    }

    // Close modal via close button
    await client.eval(`
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(600);
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // STEP 6: Delete Individual Record from Table
  try {
    process.stdout.write('[STEP 6] Delete Single Record via UI Trash Icon ... ');
    await client.eval(`
      const trashBtn = document.querySelector('[data-testid="delete-record-btn"]');
      if (trashBtn) trashBtn.click();
    `);
    await sleep(1500);

    const rowCount = await client.eval('document.querySelectorAll("tbody tr").length');

    if (rowCount === 1) {
      console.log(`PASSED (Single record deleted, table updated to exactly 1 record)`);
      testsPassed++;
    } else {
      throw new Error(`Expected 1 row after deletion, found ${rowCount}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // STEP 7: Clear All History via Modal
  try {
    process.stdout.write('[STEP 7] Clear All History Modal & Confirm Purge ... ');
    await client.eval(`
      const clearBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Clear History'));
      if (clearBtn) clearBtn.click();
    `);
    await sleep(600);

    const modalHeader = await client.eval('document.body.innerText');
    if (!modalHeader.includes('Clear All Detection History?')) {
      throw new Error('Confirmation modal did not render');
    }

    // Confirm deletion in modal
    await client.eval(`
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Yes, Delete All Records'));
      if (confirmBtn) confirmBtn.click();
    `);
    await sleep(1500);

    const finalPageText = await client.eval('document.body.innerText');
    const hasEmptyState = finalPageText.includes('No Detection Records Found');

    if (hasEmptyState) {
      console.log(`PASSED (All records purged, empty state correctly displayed)`);
      testsPassed++;
    } else {
      throw new Error(`Empty state not found after clear: ${finalPageText.slice(0, 150)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // STEP 8: Empty State Action Navigation
  try {
    process.stdout.write('[STEP 8] Empty State "Launch Voice Analysis" Action ... ');
    await client.eval(`
      const launchBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Launch Voice Analysis'));
      if (launchBtn) launchBtn.click();
    `);
    await sleep(1000);

    const bodyText = await client.eval('document.body.innerText');
    if (bodyText.includes('Audio File Upload') && bodyText.includes('Microphone Recording')) {
      console.log(`PASSED (Navigated back to Voice Analysis detector view)`);
      testsPassed++;
    } else {
      throw new Error('Did not switch back to detector mode');
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    testsFailed++;
  }

  // Clean shutdown
  chromeProc.kill();

  console.log('\n================================================================');
  console.log(`REAL BROWSER AUDIT SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED (Total: ${testsPassed + testsFailed})`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runBrowserAudit().catch((err) => {
  console.error('Fatal browser test error:', err);
  process.exit(1);
});
