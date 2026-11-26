import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\hp\\.gemini\\antigravity-cli\\brain\\77321db5-39d8-4fcb-87b9-1d98b2620ead\\scratch\\chrome_denial_test';

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

async function testPermissionDenial() {
  console.log('[DENIAL AUDIT] Launching Chrome with microphone permission denied...');
  // Launch Chrome with deny-permission-prompts
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1280,800',
    '--disable-gpu',
    '--deny-permission-prompts',
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

  // Switch to Voice Analysis -> Microphone Recording tab
  await client.eval(`
    const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch Voice Analysis') || b.textContent.includes('Voice Analysis'));
    if (tab) tab.click();
  `);
  await sleep(600);

  await client.eval(`
    const micTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Microphone Recording'));
    if (micTab) micTab.click();
  `);
  await sleep(500);

  // Click Start Recording
  await client.eval(`
    const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Recording'));
    if (startBtn) startBtn.click();
  `);
  await sleep(800);

  const errorRendered = await client.eval(`
    document.body.innerText.includes('Microphone permission was denied')
  `);

  if (errorRendered) {
    console.log('PASSED: Permission denial banner correctly surfaced in DOM ("Microphone permission was denied")');
  } else {
    const text = await client.eval('document.body.innerText');
    console.error('FAILED: Permission denial message not found. DOM:\n', text.substring(0, 300));
    process.exit(1);
  }

  if (client.ws) client.ws.close();
  chromeProcess.kill();
  process.exit(0);
}

testPermissionDenial().catch(console.error);
