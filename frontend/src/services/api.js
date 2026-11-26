/**
 * VoiceGuard API Service
 * =====================
 * Local client interface for the FastAPI VoiceGuard backend.
 * Base URL defaults to http://127.0.0.1:8000.
 */

export function getApiBaseUrl() {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) 
    || (typeof process !== 'undefined' && process.env?.VITE_API_URL) 
    || 'http://127.0.0.1:8000';
}

/**
 * Returns the WebSocket endpoint for real-time live detection streaming.
 * @returns {string} ws:// or wss:// URL
 */
export function getLiveWebSocketUrl() {
  const httpUrl = getApiBaseUrl();
  const wsUrl = httpUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  return `${wsUrl}/api/ws/live`;
}

/**
 * Fetch backend health status.
 * @returns {Promise<{ status: string, model_loaded: boolean, device: string, uptime_seconds: number }>}
 */
export async function checkHealth() {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Health check returned status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Unable to connect to local VoiceGuard backend.');
  }
}

/**
 * Fetch model architecture and configuration metadata.
 * @returns {Promise<any>}
 */
export async function getModelInfo() {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/model-info`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Model info returned status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to retrieve model specifications.');
  }
}

/**
 * Upload an audio file (File or Blob) to the local backend for classification.
 * @param {File|Blob} audioFile 
 * @param {string} [filename] Optional filename override
 * @param {string} [source='upload'] Origin tag ('upload' or 'recording')
 * @returns {Promise<any>} PredictionResponse object
 */
export async function predictVoice(audioFile, filename, source = 'upload') {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  const resolvedName = filename || (audioFile instanceof File ? audioFile.name : 'audio_recording.wav');
  formData.append('file', audioFile, resolvedName);

  try {
    const res = await fetch(`${baseUrl}/api/predict?source=${encodeURIComponent(source)}`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.detail || `Inference server error (HTTP ${res.status})`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && (err.message.includes('fetch failed') || err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED'))) {
      throw new Error('Connection refused: VoiceGuard backend is offline. Ensure uvicorn is running on port 8000.');
    }
    throw err;
  }
}

/**
 * Fetch local MongoDB database health status.
 * @returns {Promise<{ status: string, connected: boolean, database: string, collection: string, ping_ms: number|null, error: string|null }>}
 */
export async function checkDatabaseHealth() {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/database/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Database health check returned status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    return {
      status: 'unavailable',
      connected: false,
      database: 'voiceguard_db',
      collection: 'detection_history',
      ping_ms: null,
      error: err.message || 'Unable to connect to local database service.',
    };
  }
}

/**
 * Retrieve paginated detection history.
 * @param {number} [page=1]
 * @param {number} [pageSize=10]
 * @param {string|null} [classFilter=null]
 * @param {string|null} [sourceFilter=null]
 * @returns {Promise<{ items: Array, total_count: number, page: number, page_size: number, total_pages: number, summary: Object }>}
 */
export async function getDetectionHistory(page = 1, pageSize = 10, classFilter = null, sourceFilter = null) {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (classFilter && classFilter !== 'all') {
    params.append('class_filter', classFilter);
  }
  if (sourceFilter && sourceFilter !== 'all') {
    params.append('source_filter', sourceFilter);
  }

  try {
    const res = await fetch(`${baseUrl}/api/history?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.detail || `Failed to fetch history (HTTP ${res.status})`);
    }

    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Error communicating with detection history service.');
  }
}

/**
 * Retrieve detailed metadata for a single detection record.
 * @param {string} detectionId
 * @returns {Promise<Object>}
 */
export async function getDetectionDetail(detectionId) {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/history/${encodeURIComponent(detectionId)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.detail || `Record not found (HTTP ${res.status})`);
    }

    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Error fetching detection record details.');
  }
}

/**
 * Delete a single detection record by its unique detection ID.
 * @param {string} detectionId
 * @returns {Promise<{ success: boolean, detection_id: string, message: string }>}
 */
export async function deleteDetection(detectionId) {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/history/${encodeURIComponent(detectionId)}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.detail || `Failed to delete record (HTTP ${res.status})`);
    }

    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Error deleting detection record.');
  }
}

/**
 * Clear all detection records from detection_history collection.
 * @returns {Promise<{ success: boolean, deleted_count: number, message: string }>}
 */
export async function clearAllHistory() {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/history`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.detail || `Failed to clear history (HTTP ${res.status})`);
    }

    return await res.json();
  } catch (err) {
    throw new Error(err.message || 'Error clearing detection history.');
  }
}
