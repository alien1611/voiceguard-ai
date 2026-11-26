/**
 * VoiceGuard AI — Phase 4 Database & Detection History Integration Test Suite
 * ===========================================================================
 * Verifies:
 * 1. GET /api/database/health (Ping, connected status, database, collection)
 * 2. POST /api/predict persistence (Audio inference with automatic MongoDB logging)
 * 3. GET /api/history (Paginated listing, summary metrics: total, bonafide, spoof)
 * 4. GET /api/history/{detection_id} (Full technical record detail retrieval)
 * 5. GET /api/history with class_filter (Filtering by BONAFIDE vs SPOOF)
 * 6. DELETE /api/history/{detection_id} (Single record deletion)
 * 7. Ingestion of multiple records and DELETE /api/history (Clear all history)
 * 8. Validation of schema: no raw audio bytes stored in MongoDB
 */

import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:8000';
const wavPath = process.env.TEST_WAV_PATH || path.resolve('test_sample.wav');
const mp3Path = process.env.TEST_MP3_PATH || path.resolve('test_sample.wav');

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('VOICEGUARD AI — PHASE 4 LOCAL MONGODB INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Database Health
  try {
    process.stdout.write('[TEST 1] GET /api/database/health ... ');
    const res = await fetch(`${API_BASE}/api/database/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.connected === true && data.database === 'voiceguard_db' && data.collection === 'detection_history' && typeof data.ping_ms === 'number') {
      console.log(`PASSED (Status: ${data.status}, DB: ${data.database}, Ping: ${data.ping_ms.toFixed(2)} ms)`);
      passed++;
    } else {
      throw new Error(`Unexpected DB health response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // Clear any existing history first to ensure clean state
  await fetch(`${API_BASE}/api/history`, { method: 'DELETE' }).catch(() => null);

  // TEST 2: Ingest Audio & Verify Persistence
  let createdDetectionId = null;
  try {
    process.stdout.write('[TEST 2] POST /api/predict (Audio inference + auto-save) ... ');
    const fileBytes = fs.readFileSync(wavPath);
    const blob = new Blob([fileBytes], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, 'test_mira_cmd.wav');

    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.db_saved === true && data.detection_id && typeof data.detection_id === 'string') {
      createdDetectionId = data.detection_id;
      console.log(`PASSED (Class: ${data.predicted_class}, Conf: ${(data.confidence * 100).toFixed(1)}%, Saved ID: ${data.detection_id})`);
      passed++;
    } else {
      throw new Error(`Expected db_saved=true and detection_id: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 3: Retrieve History List & Summary
  try {
    process.stdout.write('[TEST 3] GET /api/history (List detections & summary) ... ');
    const res = await fetch(`${API_BASE}/api/history?page=1&page_size=10`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.total_count >= 1 && Array.isArray(data.items) && data.summary.total_detections >= 1) {
      const match = data.items.find(i => i.id === createdDetectionId || i.detection_id === createdDetectionId);
      if (!match) throw new Error(`Created detection ID ${createdDetectionId} not found in history`);
      console.log(`PASSED (Total: ${data.total_count}, Items returned: ${data.items.length}, Summary: ${data.summary.total_detections} recorded)`);
      passed++;
    } else {
      throw new Error(`Invalid history structure: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 4: Retrieve Single Detection Detail
  try {
    process.stdout.write(`[TEST 4] GET /api/history/${createdDetectionId} (Record detail) ... `);
    const res = await fetch(`${API_BASE}/api/history/${createdDetectionId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (
      (data.id === createdDetectionId || data.detection_id === createdDetectionId) &&
      data.filename === 'test_mira_cmd.wav' &&
      typeof data.spoof_score === 'number' &&
      typeof data.bonafide_score === 'number' &&
      data.audio_metadata &&
      data.model_info &&
      (data.created_at || data.timestamp)
    ) {
      console.log(`PASSED (Filename: ${data.filename}, Logit: ${data.raw_logit.toFixed(3)}, Audio Hash: ${data.audio_metadata.audio_hash?.slice(0, 16)}...)`);
      passed++;
    } else {
      throw new Error(`Incomplete record detail: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 5: Second Ingestion (MP3) and Class Filtering
  let secondId = null;
  try {
    process.stdout.write('[TEST 5] Ingest MP3 + Test Class Filter (class_filter=SPOOF) ... ');
    const fileBytes = fs.readFileSync(mp3Path);
    const blob = new Blob([fileBytes], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('file', blob, 'test_mira_tts.mp3');

    const postRes = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
    });
    const postData = await postRes.json();
    secondId = postData.detection_id;

    // Filter by SPOOF
    const filterRes = await fetch(`${API_BASE}/api/history?class_filter=SPOOF`);
    const filterData = await filterRes.json();
    const allSpoof = filterData.items.every(i => i.predicted_class === 'SPOOF');

    if (allSpoof && filterData.total_count >= 1) {
      console.log(`PASSED (SPOOF filter returned ${filterData.total_count} record(s), all matching class SPOOF)`);
      passed++;
    } else {
      throw new Error(`Class filter validation failed: ${JSON.stringify(filterData)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 6: Pagination verification
  try {
    process.stdout.write('[TEST 6] GET /api/history pagination (page=1, page_size=1) ... ');
    const res = await fetch(`${API_BASE}/api/history?page=1&page_size=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.items.length === 1 && data.total_pages >= 2 && data.page_size === 1) {
      console.log(`PASSED (Page 1 has 1 item, total_pages: ${data.total_pages}, total_count: ${data.total_count})`);
      passed++;
    } else {
      throw new Error(`Unexpected pagination output: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 7: Delete Single Record
  try {
    process.stdout.write(`[TEST 7] DELETE /api/history/${createdDetectionId} ... `);
    const res = await fetch(`${API_BASE}/api/history/${createdDetectionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if ((data.deleted === true || data.success === true) && data.detection_id === createdDetectionId) {
      // Verify it's gone
      const verifyRes = await fetch(`${API_BASE}/api/history/${createdDetectionId}`);
      if (verifyRes.status === 404) {
        console.log(`PASSED (Record deleted, subsequent GET returned HTTP 404 Not Found)`);
        passed++;
      } else {
        throw new Error(`Record still exists after delete: HTTP ${verifyRes.status}`);
      }
    } else {
      throw new Error(`Unexpected delete response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 8: Clear All History
  try {
    process.stdout.write('[TEST 8] DELETE /api/history (Clear all) ... ');
    const res = await fetch(`${API_BASE}/api/history`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if ((data.cleared === true || data.success === true) && typeof data.deleted_count === 'number') {
      // Verify history is empty
      const listRes = await fetch(`${API_BASE}/api/history`);
      const listData = await listRes.json();
      if (listData.total_count === 0 && listData.items.length === 0) {
        console.log(`PASSED (Cleared ${data.deleted_count} record(s), history is now completely empty)`);
        passed++;
      } else {
        throw new Error(`History not empty after clear: ${listData.total_count} items remain`);
      }
    } else {
      throw new Error(`Unexpected clear response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  // TEST 9: Privacy & Data Hygiene Verification (No audio bytes stored)
  try {
    process.stdout.write('[TEST 9] Schema & Privacy Audit (No raw audio/PCM stored) ... ');
    // Ingest one more test file to inspect raw MongoDB document
    const fileBytes = fs.readFileSync(wavPath);
    const blob = new Blob([fileBytes], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, 'hygiene_check.wav');

    const postRes = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      body: formData,
    });
    const postData = await postRes.json();
    const detailRes = await fetch(`${API_BASE}/api/history/${postData.detection_id}`);
    const detailData = await detailRes.json();

    const detailKeys = Object.keys(detailData);
    const audioMetaKeys = Object.keys(detailData.audio_metadata || {});

    const forbiddenFields = ['audio', 'raw_audio', 'waveform', 'samples', 'pcm', 'audio_bytes', 'features', 'lfcc_matrix', 'tensor'];
    const foundForbidden = forbiddenFields.filter(f => detailKeys.includes(f) || audioMetaKeys.includes(f));

    if (foundForbidden.length === 0) {
      console.log(`PASSED (Strict compliance: zero raw audio bytes or LFCC tensors stored in DB)`);
      passed++;
    } else {
      throw new Error(`Forbidden fields detected in stored document: ${foundForbidden.join(', ')}`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`PHASE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
