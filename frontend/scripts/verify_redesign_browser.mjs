import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\hp\\temp_chrome_audit';
const SCREENSHOT_DIR = path.resolve('./screenshots');
const TEST_AUDIO_PATH = path.resolve('./frontend/test_sample.wav');

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

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

async function getBrowserTargets() {
  return new Promise((resolve, reject) => {
    http
      .get('http://127.0.0.1:9222/json/list', (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(client, filename, width = 1440, height = 900, isMobile = false) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: isMobile,
  });
  await sleep(600);
  const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log(`[SCREENSHOT] Saved: ${outPath} (${width}x${height})`);
}

async function main() {
  console.log('================================================================');
  console.log('VOICEGUARD AI — REDESIGN VERIFICATION & REAL BROWSER AUDIT');
  console.log('================================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const chromeArgs = [
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:5173/?tab=detector',
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

  let client = null;
  for (let i = 0; i < 20; i++) {
    await sleep(600);
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
    throw new Error('Failed to connect to Chrome on port 9222');
  }

  try {
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await sleep(2000);

    // 1. Initial Verify Audio Workspace Screenshot (Empty Upload State)
    console.log('[STEP 1] Capturing Initial Upload State across 3 breakpoints...');
    await capture(client, 'redesign_upload_empty_1440.png', 1440, 900, false);
    await capture(client, 'redesign_upload_empty_768.png', 768, 1024, true);
    await capture(client, 'redesign_upload_empty_390.png', 390, 844, true);

    // Reset to desktop viewport for interaction
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(500);

    // 2. Select file via DataTransfer and dispatch change event
    console.log('[STEP 2] Simulating file selection with real audio...');
    const wavBuffer = fs.readFileSync(TEST_AUDIO_PATH);
    const wavBase64 = wavBuffer.toString('base64');

    const fileSelected = await client.eval(`
      (() => {
        const b64 = '${wavBase64}';
        const byteCharacters = atob(b64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const file = new File([byteArray], 'mira_cmd.wav', { type: 'audio/wav' });

        const input = document.querySelector('input[type="file"]');
        if (!input) return false;

        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);

    if (!fileSelected) {
      throw new Error('Could not select file on input element');
    }

    // Wait for client-side waveform decoding
    await sleep(2500);

    // 3. Capture Waveform Workspace (After File Selection)
    console.log('[STEP 3] Waveform decoded! Capturing Audio Workspace State...');
    await capture(client, 'redesign_waveform_workspace_1440.png', 1440, 900, false);
    await capture(client, 'redesign_waveform_workspace_768.png', 768, 1024, true);
    await capture(client, 'redesign_waveform_workspace_390.png', 390, 844, true);

    // Reset to desktop for verification click
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(500);

    // 4. Click "Verify Audio" button
    console.log('[STEP 4] Clicking "Verify Audio" button...');
    const verifyClicked = await client.eval(`
      (() => {
        const submitBtn = document.querySelector('[data-testid="verify-submit-btn"]');
        if (submitBtn) {
          submitBtn.click();
          return { found: true, text: submitBtn.innerText, method: 'testid' };
        }
        const btns = Array.from(document.querySelectorAll('button'));
        // Find button that has uppercase VERIFY AUDIO and is not in nav
        const verifyBtn = btns.find(b => b.innerText.trim() === 'VERIFY AUDIO' || (b.innerText.toLowerCase().includes('verify audio') && b.className.includes('bg-app-accent')));
        if (verifyBtn) {
          verifyBtn.click();
          return { found: true, text: verifyBtn.innerText, method: 'fallback' };
        }
        return { found: false, btns: btns.map(b => b.innerText) };
      })()
    `);

    console.log('[STEP 4 Click Result]:', verifyClicked);

    if (!verifyClicked || !verifyClicked.found) {
      throw new Error('Verify Audio button not found or not clickable: ' + JSON.stringify(verifyClicked));
    }

    // Wait for backend inference response
    console.log('[STEP 5] Awaiting inference response from FastAPI backend...');
    let resultRendered = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const text = await client.eval('document.body.innerText');
      if (
        text.includes('BONAFIDE') ||
        text.includes('SPOOF') ||
        text.toLowerCase().includes('verification verdict')
      ) {
        resultRendered = true;
        console.log('[STEP 5 Detection Found]: Text matched verdict keyword');
        break;
      }
      if (text.includes('Validation Notice') || text.includes('error')) {
        console.log('[STEP 5 Page Notice]:', text.split('\n').slice(0, 8).join(' | '));
      }
    }

    if (!resultRendered) {
      const finalBody = await client.eval('document.body.innerText');
      console.log('[FINAL PAGE BODY]:\n', finalBody);
      throw new Error('Result display did not appear within 15 seconds');
    }

    if (!resultRendered) {
      throw new Error('Result display did not appear within 12 seconds');
    }

    console.log('[STEP 6] Result received and rendered! Capturing Result Presentation...');
    await capture(client, 'redesign_result_1440.png', 1440, 900, false);
    await capture(client, 'redesign_result_768.png', 768, 1024, true);
    await capture(client, 'redesign_result_390.png', 390, 844, true);

    // 7. Navigate to Overview and capture across 3 breakpoints
    console.log('[STEP 7] Navigating to Overview...');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/?tab=overview' });
    await sleep(2000);
    console.log('[STEP 7] Capturing Overview across 3 breakpoints...');
    await capture(client, 'voiceguard_overview_1440.png', 1440, 900, false);
    await capture(client, 'voiceguard_overview_768.png', 768, 1024, true);
    await capture(client, 'voiceguard_overview_390.png', 390, 844, true);

    // 8. Navigate to Detection History and capture across 3 breakpoints
    console.log('[STEP 8] Navigating to Detection History...');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/?tab=history' });
    await sleep(2000);
    console.log('[STEP 8] Capturing Detection History across 3 breakpoints...');
    await capture(client, 'voiceguard_history_1440.png', 1440, 900, false);
    await capture(client, 'voiceguard_history_768.png', 768, 1024, true);
    await capture(client, 'voiceguard_history_390.png', 390, 844, true);

    console.log('\n================================================================');
    console.log('ALL VERIFICATION AUDITS PASSED WITH ZERO ERRORS!');
    console.log('================================================================');
  } finally {
    client.close();
    chromeProc.kill();
  }
}

main().catch((err) => {
  console.error('\n[AUDIT FAILED]:', err);
  process.exit(1);
});
