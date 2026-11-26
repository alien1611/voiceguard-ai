/**
 * VoiceGuard Formatting Utilities
 */

/**
 * Format raw byte count into human-readable string (KB, MB).
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format seconds into mm:ss format.
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format float score (0.0 to 1.0) into a percentage string (e.g. "86.5%").
 */
export function formatPercent(score, decimals = 1) {
  if (score === undefined || score === null || isNaN(score)) return '0.0%';
  return `${(score * 100).toFixed(decimals)}%`;
}
