import { checkHealth, predictVoice } from '../src/services/api.js';

process.env.VITE_API_URL = 'http://127.0.0.1:54321';

async function testOffline() {
  console.log('[TEST OFFLINE] Testing API client error handling when backend port 54321 is down...');
  
  try {
    await checkHealth();
    console.error('FAILED: Expected checkHealth to throw when backend is offline.');
    process.exit(1);
  } catch (err) {
    console.log(`PASSED: checkHealth caught offline backend error: "${err.message}"`);
  }

  try {
    const fakeBlob = new Blob(['dummy audio content'], { type: 'audio/wav' });
    await predictVoice(fakeBlob, 'test.wav');
    console.error('FAILED: Expected predictVoice to throw when backend is offline.');
    process.exit(1);
  } catch (err) {
    console.log(`PASSED: predictVoice caught offline backend error: "${err.message}"`);
  }
}

testOffline();
