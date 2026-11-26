import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileAudio, 
  Trash2, 
  Eye, 
  RefreshCw, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { 
  getDetectionHistory, 
  getDetectionDetail, 
  deleteDetection, 
  clearAllHistory, 
  checkDatabaseHealth 
} from '../services/api';
import { formatPercent, formatBytes } from '../utils/formatters';

export default function HistoryView({ onNavigateToDetector }) {
  const [historyData, setHistoryData] = useState({
    items: [],
    total_count: 0,
    page: 1,
    page_size: 10,
    total_pages: 1,
    summary: {
      total_detections: 0,
      bonafide_count: 0,
      spoof_count: 0,
    },
  });

  const [dbHealth, setDbHealth] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [classFilter, setClassFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const refreshDbHealth = useCallback(async () => {
    try {
      const health = await checkDatabaseHealth();
      setDbHealth(health);
    } catch {
      setDbHealth({ connected: false, status: 'unavailable', ping_ms: null });
    }
  }, []);

  const fetchHistory = useCallback(
    async (page = currentPage, size = pageSize, filter = classFilter, srcFilter = sourceFilter) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getDetectionHistory(
          page, 
          size, 
          filter === 'all' ? null : filter,
          srcFilter === 'all' ? null : srcFilter
        );
        setHistoryData(data);
      } catch (err) {
        setError(err.message || 'Failed to retrieve detection history.');
      } finally {
        setIsLoading(false);
      }
    },
    [currentPage, pageSize, classFilter, sourceFilter]
  );

  useEffect(() => {
    refreshDbHealth();
    fetchHistory(currentPage, pageSize, classFilter, sourceFilter);
  }, [fetchHistory, refreshDbHealth, currentPage, pageSize, classFilter, sourceFilter]);

  const handleFilterChange = (newFilter) => {
    setClassFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSourceFilterChange = (newSrc) => {
    setSourceFilter(newSrc);
    setCurrentPage(1);
  };

  const handleViewDetails = async (record) => {
    setIsLoadingDetail(true);
    setSelectedRecord(record);
    try {
      const recId = record.detection_id || record.id;
      if (recId) {
        const fullDetail = await getDetectionDetail(recId);
        setSelectedRecord(fullDetail);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDeleteRecord = async (detectionId, e) => {
    e.stopPropagation();
    if (!detectionId) return;

    try {
      await deleteDetection(detectionId);
      setHistoryData((prev) => ({
        ...prev,
        items: prev.items.filter((item) => (item.detection_id || item.id) !== detectionId),
        total_count: Math.max(0, prev.total_count - 1),
      }));
    } catch (err) {
      alert(`Could not delete record: ${err.message}`);
    }
  };

  const handleConfirmClearAll = async () => {
    setIsDeleting(true);
    try {
      await clearAllHistory();
      setShowClearModal(false);
      fetchHistory(1, pageSize, classFilter);
    } catch (err) {
      alert(`Could not clear history: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const displayedItems = historyData.items.filter((item) => {
    if (!searchQuery) return true;
    const name = (item.filename || '').toLowerCase();
    const id = (item.detection_id || item.id || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || id.includes(q);
  });

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-widest text-brand-primary font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Audit Records Archive</span>
          </div>
          <h2 className="editorial-display text-2xl sm:text-3xl font-bold text-espresso tracking-tight">
            Verification History
          </h2>
          <p className="text-sm text-espresso-secondary mt-0.5">
            Review, filter, and inspect persisted micro-acoustic verification records and telemetry logs.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {historyData.total_count > 0 && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-bg-surface hover:bg-spoof-bg text-espresso-secondary hover:text-spoof border border-border-subtle text-xs font-medium rounded-md transition-all shadow-soft"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchHistory(currentPage, pageSize, classFilter)}
            className="p-2 bg-bg-surface hover:bg-bg-secondary text-espresso-secondary hover:text-espresso border border-border-subtle rounded-md transition-all shadow-soft"
            title="Refresh records"
            aria-label="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-brand-terracotta' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3.5 bg-bg-surface p-5 rounded-xl border border-border-subtle shadow-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Class Filter Chips */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono text-espresso-muted mr-1 uppercase">Class:</span>
            {[
              { id: 'all', label: 'All Records' },
              { id: 'bonafide', label: 'Human Speech' },
              { id: 'spoof', label: 'Synthetic Spoof' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFilterChange(f.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                  classFilter === f.id
                    ? 'bg-brand-primary text-bg-surface shadow-soft font-semibold'
                    : 'bg-bg-secondary hover:bg-border-subtle text-espresso-secondary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by target filename or ID..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-bg-secondary/60 border border-border-subtle rounded-md text-espresso placeholder:text-espresso-muted focus:bg-bg-surface focus:outline-none focus:border-brand-terracotta"
            />
          </div>
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center space-x-2 pt-2.5 border-t border-border-subtle">
          <span className="text-[11px] font-mono text-espresso-muted mr-1 uppercase">Channel:</span>
          {[
            { id: 'all', label: 'All Channels' },
            { id: 'upload', label: 'File Upload' },
            { id: 'recording', label: 'Microphone Studio' },
            { id: 'live', label: 'Live Stream' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSourceFilterChange(s.id)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                sourceFilter === s.id
                  ? 'bg-brand-caramel-subtle text-brand-primary font-bold border border-brand-caramel/30'
                  : 'text-espresso-secondary hover:text-espresso'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Database Warning if Offline */}
      {dbHealth && !dbHealth.connected && (
        <div className="p-4 bg-warning-bg border border-warning-border rounded-xl text-xs text-warning flex items-start space-x-3 shadow-soft">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Database offline. Operating in volatile memory mode; historical records will populate once local MongoDB is reachable.
          </span>
        </div>
      )}

      {/* Clean Editorial Archive Table */}
      <div className="bg-bg-surface rounded-xl border border-border-subtle overflow-hidden shadow-card">
        {displayedItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-bg-secondary/60 text-espresso-secondary uppercase text-[10px] tracking-wider border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-5 font-medium">Audio Target</th>
                  <th className="py-3 px-5 font-medium">Channel</th>
                  <th className="py-3 px-5 font-medium">Prediction</th>
                  <th className="py-3 px-5 font-medium">Confidence</th>
                  <th className="py-3 px-5 font-medium">Date &amp; Time</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {displayedItems.map((item, idx) => {
                  const isBona = item.predicted_class === 'BONAFIDE';
                  const recId = item.detection_id || item.id;
                  const itemSource = (item.source || 'upload').toLowerCase();
                  const dateStr = item.created_at
                    ? new Date(item.created_at).toLocaleString()
                    : item.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : '—';

                  return (
                    <tr
                      key={recId || idx}
                      onClick={() => handleViewDetails(item)}
                      className="hover:bg-bg-secondary/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-5 font-medium text-espresso max-w-xs truncate">
                        <div className="flex items-center space-x-2.5">
                          <FileAudio className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{item.filename || 'audio_file.wav'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                            itemSource === 'live'
                              ? 'bg-brand-caramel-subtle text-brand-primary border border-brand-caramel/30 font-semibold'
                              : itemSource === 'recording'
                              ? 'bg-bg-secondary text-espresso font-medium border border-border-subtle'
                              : 'bg-bg-secondary/60 text-espresso-secondary border border-border-subtle'
                          }`}
                        >
                          {itemSource}
                        </span>
                      </td>

                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            isBona
                              ? 'bg-bonafide-bg text-bonafide border border-bonafide-border'
                              : 'bg-spoof-bg text-spoof border border-spoof-border'
                          }`}
                        >
                          {item.predicted_class}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-espresso font-semibold">
                        {formatPercent(item.confidence)}
                      </td>

                      <td className="py-3.5 px-5 text-espresso-secondary text-[11px]">
                        {dateStr}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleViewDetails(item)}
                            className="p-1 text-espresso-secondary hover:text-espresso rounded hover:bg-bg-secondary"
                            title="Inspect details"
                            aria-label="Inspect record details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRecord(recId, e)}
                            className="p-1 text-espresso-secondary hover:text-spoof rounded hover:bg-spoof-bg"
                            title="Delete record"
                            aria-label="Delete detection record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 px-4 text-center space-y-3">
            <p className="font-serif font-bold text-base text-espresso">
              {searchQuery || classFilter !== 'all'
                ? 'No matching verification records found'
                : 'No detection records found'}
            </p>
            <p className="text-xs text-espresso-secondary max-w-sm mx-auto">
              {searchQuery || classFilter !== 'all'
                ? 'Try adjusting your search query or class filter.'
                : 'Verify speech recordings to populate historical telemetry.'}
            </p>
            {onNavigateToDetector && (
              <button
                type="button"
                onClick={onNavigateToDetector}
                className="mt-2 inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta-hover text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft"
              >
                <span>Verify Audio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {historyData.total_pages > 1 && (
          <div className="p-4 bg-bg-secondary/40 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-espresso-secondary">
            <span>
              Page {historyData.page} of {historyData.total_pages} ({historyData.total_count} records)
            </span>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md bg-bg-surface hover:bg-bg-secondary border border-border-subtle disabled:opacity-40 shadow-soft"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= historyData.total_pages || isLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 rounded-md bg-bg-surface hover:bg-bg-secondary border border-border-subtle disabled:opacity-40 shadow-soft"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Details Modal Inspector */}
      {selectedRecord && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 glassy-modal-backdrop select-none animate-in fade-in duration-200"
          onClick={() => setSelectedRecord(null)}
        >
          <div 
            className="bg-bg-surface rounded-2xl border border-border-subtle max-w-lg w-full p-7 space-y-5 shadow-elevated animate-in fade-in zoom-in-95 duration-200 relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center space-x-3">
                <FileAudio className="w-4 h-4 text-brand-primary" />
                <h3 className="font-serif font-bold text-base text-espresso truncate max-w-xs">
                  {selectedRecord.filename || 'Detection Record'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-espresso-secondary hover:text-espresso"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-border-subtle/60 text-espresso-secondary">
                <span>Record Identifier:</span>
                <span className="text-espresso font-semibold">{selectedRecord.detection_id || selectedRecord.id || '—'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border-subtle/60 text-espresso-secondary">
                <span>Source Channel:</span>
                <span className="uppercase text-brand-terracotta font-semibold">{selectedRecord.source || 'upload'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border-subtle/60 text-espresso-secondary">
                <span>Classification:</span>
                <span className={`font-bold ${selectedRecord.predicted_class === 'BONAFIDE' ? 'text-bonafide' : 'text-spoof'}`}>
                  {selectedRecord.predicted_class}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-border-subtle/60 text-espresso-secondary">
                <span>Confidence Rating:</span>
                <span className="text-espresso font-bold">{formatPercent(selectedRecord.confidence)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border-subtle/60 text-espresso-secondary">
                <span>Calibrated Cutoff:</span>
                <span className="text-espresso">{selectedRecord.threshold !== undefined ? selectedRecord.threshold.toFixed(4) : '0.1590'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border-subtle/60 text-espresso-secondary">
                <span>Raw CNN Logit:</span>
                <span className="text-espresso">{selectedRecord.raw_logit !== undefined ? selectedRecord.raw_logit.toFixed(4) : '—'}</span>
              </div>

              <div className="flex justify-between py-1 text-espresso-secondary">
                <span>Analyzed Timestamp:</span>
                <span className="text-espresso">
                  {selectedRecord.created_at ? new Date(selectedRecord.created_at).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-deep text-bg-surface text-xs font-semibold rounded-md transition-all shadow-soft"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 glassy-modal-backdrop select-none animate-in fade-in duration-200"
          onClick={() => setShowClearModal(false)}
        >
          <div 
            className="bg-bg-surface rounded-2xl border border-border-subtle max-w-sm w-full p-6 space-y-4 shadow-elevated animate-in fade-in zoom-in-95 duration-200 relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 text-spoof">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-serif font-bold text-base text-espresso">Clear Audit History?</h3>
            </div>
            <p className="text-xs text-espresso-secondary leading-relaxed">
              This action will permanently delete all persisted verification records from local storage. This action cannot be reversed.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isDeleting}
                className="px-3.5 py-2 bg-bg-surface hover:bg-bg-secondary border border-border-subtle text-xs text-espresso rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                disabled={isDeleting}
                className="px-4 py-2 bg-spoof hover:bg-spoof/90 text-bg-surface text-xs font-semibold rounded-md disabled:opacity-50"
              >
                {isDeleting ? 'Clearing...' : 'Clear All Records'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
