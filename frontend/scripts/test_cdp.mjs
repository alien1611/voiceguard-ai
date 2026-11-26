import { spawn } from 'child_process';
import http from 'http';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\hp\\.gemini\\antigravity-cli\\brain\\77321db5-39d8-4fcb-87b9-1d98b2620ead\\scratch\\chrome_test';

const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--disable-gpu',
  'http://127.0.0.1:5173',
]);

chrome.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('DevTools listening on')) {
    console.log('[CHROME] ' + msg.trim());
    
    // Check debugging port
    http.get('http://127.0.0.1:9222/json/version', (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('[CDP VERSION] ' + body);
        chrome.kill();
        process.exit(0);
      });
    });
  }
});

chrome.on('error', (err) => {
  console.error('[CHROME ERROR]', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout waiting for Chrome DevTools');
  chrome.kill();
  process.exit(1);
}, 8000);
