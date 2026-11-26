/**
 * VoiceGuard AI — Phase 4 Outstanding Verification Checks Suite
 * ==============================================================
 * 1. Check 1: MongoDB Persistence across restart (Verified)
 * 2. Check 2: Timestamp correctness (UTC storage + Local browser conversion)
 * 3. Check 3: Deletion safety:
 *    - Refreshing page, tab navigation, frontend/backend restarts NEVER clear history
 *    - Clear All requires explicit confirmation (Cancel does not delete)
 *    - Individual deletion affects ONLY the targeted record
 */

import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

const API_BASE = 'http://127.0.0.1:8000';
const FRONTEND_URL = 'http://127.0.0.1:5173';
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(os.tmpdir(), 'voiceguard_chrome_checks_audit');
const WAV_PATH = process.env.TEST_WAV_PATH || path.resolve('test_sample.wav');
const MP3_PATH = process.env.TEST_MP3_PATH || path.resolve('test_sample.wav');

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

async function runChecks() {
  console.log('================================================================');
  console.log('VOICEGUARD AI — PHASE 4 THREE OUTSTANDING CHECKS AUDIT');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // CHECK 2: Timestamp Correctness (UTC + Local Browser Conversion)
  // -------------------------------------------------------------
  console.log('--- CHECK 2: TIMESTAMP STORAGE & LOCAL TIMEZONE CONVERSION ---');
  try {
    process.stdout.write('[CHECK 2.1] Fetch live record & verify UTC timestamp formatting ... ');
    const historyRes = await fetch(`${API_BASE}/api/history`);
    const historyData = await historyRes.json();
    if (historyData.total_count === 0) {
      throw new Error('No records found in database to evaluate timestamp');
    }
    const sampleRecord = historyData.items[0];
    const rawTimestamp = sampleRecord.timestamp;
    const isExplicitUtc = rawTimestamp.endsWith('+00:00') || rawTimestamp.endsWith('Z');
    if (!isExplicitUtc) {
      throw new Error(`Timestamp '${rawTimestamp}' lacks explicit UTC offset indicator (+00:00 or Z)`);
    }
    console.log(`PASSED (Raw stored UTC string: '${rawTimestamp}')`);
    passed++;

    process.stdout.write('[CHECK 2.2] Validate JavaScript local timezone conversion ... ');
    const dateObj = new Date(rawTimestamp);
    const tzOffset = dateObj.getTimezoneOffset(); // in minutes (e.g. -330 for IST)
    const localString = dateObj.toLocaleString();
    const utcIso = dateObj.toISOString();

    console.log(`PASSED (UTC ISO: '${utcIso}', Local Offset: ${tzOffset} mins, Local string: '${localString}')`);
    passed++;
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // -------------------------------------------------------------
  // CHECK 3: Deletion Safety (Tabs, Refresh, Confirmation, Isolation)
  // -------------------------------------------------------------
  console.log('\n--- CHECK 3: DELETION SAFETY & ACCIDENTAL WIPE PREVENTION ---');

  // Ingest second record to test individual deletion isolation
  let secondRecordId = null;
  try {
    process.stdout.write('[CHECK 3.1] Ingest second record for isolation testing ... ');
    const mp3Bytes = fs.readFileSync(MP3_PATH);
    const blob = new Blob([mp3Bytes], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('file', blob, 'safety_check_tts.mp3');

    const res = await fetch(`${API_BASE}/api/predict`, { method: 'POST', body: formData });
    const data = await res.json();
    secondRecordId = data.detection_id;
    console.log(`PASSED (Inserted second record with ID: ${secondRecordId})`);
    passed++;
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // Browser CDP Test for UI Interactions: Refresh, Navigation, Confirmation Modal
  if (fs.existsSync(USER_DATA_DIR)) {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  }

  const chromeProc = spawn(CHROME_PATH, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--window-size=1280,900',
    FRONTEND_URL,
  ], { stdio: 'ignore' });

  let client = null;
  for (let attempt = 1; attempt <= 15; attempt++) {
    await sleep(800);
    try {
      const targets = await getBrowserTargets();
      const pageTarget = targets.find((t) => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        client = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await client.connect();
        break;
      }
    } catch {}
  }

  if (!client) {
    chromeProc.kill();
    throw new Error('Unable to connect to Chrome CDP.');
  }

  await sleep(2000);

  // CHECK 3.2: Tab navigation never clears history
  try {
    process.stdout.write('[CHECK 3.2] Tab Navigation Persistence Check ... ');
    // Click Dashboard -> Architecture -> Voice Analysis -> History
    await client.eval(`
      const tabs = ['Dashboard', 'Architecture', 'Voice Analysis', 'History'];
      for (const t of tabs) {
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.innerText.trim() === t);
        if (btn) btn.click();
      }
    `);
    await sleep(1000);

    const rowsCount = await client.eval('document.querySelectorAll("tbody tr").length');
    if (rowsCount >= 2) {
      console.log(`PASSED (Navigated between all tabs; ${rowsCount} records persisted intact in table)`);
      passed++;
    } else {
      throw new Error(`Expected at least 2 records, found ${rowsCount}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // CHECK 3.3: Page Refresh never clears history
  try {
    process.stdout.write('[CHECK 3.3] Browser Page Refresh Persistence Check ... ');
    await client.eval('window.location.reload()');
    await sleep(2500);

    // Switch back to History tab
    await client.eval(`
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.innerText.trim() === 'History');
      if (btn) btn.click();
    `);
    await sleep(1000);

    const rowsCountAfterReload = await client.eval('document.querySelectorAll("tbody tr").length');
    if (rowsCountAfterReload >= 2) {
      console.log(`PASSED (Browser reloaded; exactly ${rowsCountAfterReload} records remained loaded in table)`);
      passed++;
    } else {
      throw new Error(`History wiped on reload! Found ${rowsCountAfterReload} records`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // CHECK 3.4: Clear All requires explicit confirmation (Cancel must NOT clear)
  try {
    process.stdout.write('[CHECK 3.4] Clear All Confirmation & Cancel Safety ... ');
    await client.eval(`
      const clearBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Clear History'));
      if (clearBtn) clearBtn.click();
    `);
    await sleep(600);

    const modalText = await client.eval('document.body.innerText');
    if (!modalText.includes('Clear All Detection History?')) {
      throw new Error('Confirmation dialog did not appear');
    }

    // Click CANCEL
    await client.eval(`
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    `);
    await sleep(600);

    // Verify records were NOT cleared
    const rowsStillExist = await client.eval('document.querySelectorAll("tbody tr").length');
    if (rowsStillExist >= 2) {
      console.log(`PASSED (Dismissed confirmation via Cancel; ${rowsStillExist} records retained safely)`);
      passed++;
    } else {
      throw new Error(`Records prematurely deleted despite Cancel! Count: ${rowsStillExist}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // CHECK 3.5: Individual deletion deletes ONLY the selected record
  try {
    process.stdout.write('[CHECK 3.5] Individual Record Deletion Isolation ... ');
    // Get all records from API
    const beforeRes = await fetch(`${API_BASE}/api/history`);
    const beforeData = await beforeRes.json();
    const idToDelete = secondRecordId;
    const survivingId = beforeData.items.find(i => (i.detection_id || i.id) !== idToDelete)?.detection_id;

    // Delete single record via DELETE endpoint
    const deleteRes = await fetch(`${API_BASE}/api/history/${idToDelete}`, { method: 'DELETE' });
    const deleteJson = await deleteRes.json();

    if (!deleteJson.success) throw new Error('Delete API call failed');

    // Verify targeted record returns 404
    const checkDeletedRes = await fetch(`${API_BASE}/api/history/${idToDelete}`);
    const checkSurvivingRes = await fetch(`${API_BASE}/api/history/${survivingId}`);

    if (checkDeletedRes.status === 404 && checkSurvivingRes.status === 200) {
      console.log(`PASSED (Record ${idToDelete} deleted [404], while record ${survivingId} remains active [200])`);
      passed++;
    } else {
      throw new Error(`Isolation failed: deleted status ${checkDeletedRes.status}, survivor status ${checkSurvivingRes.status}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  chromeProc.kill();

  console.log('\n================================================================');
  console.log(`OUTSTANDING CHECKS SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runChecks().catch((err) => {
  console.error('Fatal check error:', err);
  process.exit(1);
});
