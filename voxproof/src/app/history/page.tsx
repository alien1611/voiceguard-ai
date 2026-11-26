"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { MiniWaveform } from "@/components/history/MiniWaveform";
import { Barcode } from "@/components/common/Barcode";
import {
  List,
  Grid,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Download,
  Calendar,
  Layers,
  FileAudio,
} from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();
  const items = useHistoryStore((s) => s.items);
  const filter = useHistoryStore((s) => s.filter);
  const searchQuery = useHistoryStore((s) => s.searchQuery);
  const viewMode = useHistoryStore((s) => s.viewMode);
  const setFilter = useHistoryStore((s) => s.setFilter);
  const setSearchQuery = useHistoryStore((s) => s.setSearchQuery);
  const setViewMode = useHistoryStore((s) => s.setViewMode);
  const deleteItem = useHistoryStore((s) => s.deleteItem);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  const setResult = useAnalyzerStore((s) => s.setResult);

  // Filter items
  const filtered = items.filter((item) => {
    const matchesFilter = filter === "all" || item.verdict === filter;
    const matchesSearch =
      !searchQuery ||
      item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const openInAnalyzer = (item: any) => {
    setResult(item);
    router.push("/analyze");
  };

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-8 select-none pb-24">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between pb-6 border-b border-line gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-bonafide block mb-1">
              // TELEMETRY LOGS
            </span>
            <h1 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight text-white">
              Analysis History
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">
              Showing {filtered.length} analyses
            </span>
            {items.length > 0 && (
              <button
                onClick={clearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-2 hover:bg-spoof/20 text-muted hover:text-spoof border border-line text-xs font-mono transition-colors"
                title="Clear all records"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-ink-2 p-3.5 rounded-2xl border border-line">
          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            {(["all", "spoof", "bonafide", "uncertain"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full font-mono text-xs uppercase font-bold tracking-wider transition-all ${
                  filter === f
                    ? f === "spoof"
                      ? "bg-spoof text-white"
                      : f === "bonafide"
                      ? "bg-bonafide text-ink"
                      : f === "uncertain"
                      ? "bg-uncertain text-ink"
                      : "bg-white text-ink"
                    : "bg-ink-3 text-muted hover:text-white"
                }`}
              >
                {f} ({items.filter((i) => f === "all" || i.verdict === f).length})
              </button>
            ))}
          </div>

          {/* Search & View Toggle */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter results..."
                className="w-full h-8 pl-8 pr-3 rounded-full bg-ink-3 border border-line text-xs font-mono text-white placeholder:text-muted/60 focus:outline-none focus:border-bonafide"
              />
            </div>

            {/* List / Grid Toggle */}
            <div className="flex items-center bg-ink-3 p-1 rounded-full border border-line">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === "list"
                    ? "bg-white text-ink"
                    : "text-muted hover:text-white"
                }`}
                title="List View"
                aria-label="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === "grid"
                    ? "bg-white text-ink"
                    : "text-muted hover:text-white"
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content View */}
        {filtered.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-line rounded-card">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">
              Zero records matching query
            </span>
            <button
              onClick={() => {
                setFilter("all");
                setSearchQuery("");
              }}
              className="text-bonafide font-mono text-xs underline"
            >
              Reset active filters
            </button>
          </div>
        ) : viewMode === "list" ? (
          <div className="divide-y divide-line rounded-2xl bg-ink-2 border border-line overflow-hidden">
            {filtered.map((item) => {
              const isSpoof = item.verdict === "spoof";
              const isBonafide = item.verdict === "bonafide";

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-ink-3/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Mini Waveform Thumbnail with verdict border */}
                    <div
                      className={`p-1 rounded-xl border ${
                        isSpoof
                          ? "border-spoof/40 bg-spoof/5"
                          : isBonafide
                          ? "border-bonafide/40 bg-bonafide/5"
                          : "border-uncertain/40 bg-uncertain/5"
                      }`}
                    >
                      <MiniWaveform
                        peaks={item.waveform_peaks}
                        verdict={item.verdict}
                        width={90}
                        height={32}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isSpoof
                              ? "bg-spoof/20 text-spoof"
                              : isBonafide
                              ? "bg-bonafide/20 text-bonafide"
                              : "bg-uncertain/20 text-uncertain"
                          }`}
                        >
                          {item.verdict}
                        </span>
                        <span className="font-mono text-xs text-white font-bold truncate max-w-xs sm:max-w-md">
                          {item.filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-muted">
                        <span>ID: {item.id}</span>
                        <span>·</span>
                        <span>{item.duration_s.toFixed(1)}s</span>
                        <span>·</span>
                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-white block">
                        {(item.score * 100).toFixed(0)}% Spoof Likelihood
                      </span>
                      <span className="font-mono text-[10px] text-muted block">
                        Latency: {item.timings_ms.total}ms
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openInAnalyzer(item)}
                        className="p-2 rounded-full bg-ink-3 hover:bg-line text-muted hover:text-white transition-colors"
                        title="Open in studio"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 rounded-full bg-ink-3 hover:bg-spoof/20 text-muted hover:text-spoof transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => {
              const isSpoof = item.verdict === "spoof";
              const isBonafide = item.verdict === "bonafide";

              return (
                <div
                  key={item.id}
                  className={`p-6 rounded-card bg-ink-2 border flex flex-col justify-between h-72 transition-all hover:-translate-y-1 shadow-lg ${
                    isSpoof
                      ? "border-spoof/30 hover:border-spoof"
                      : isBonafide
                      ? "border-bonafide/30 hover:border-bonafide"
                      : "border-uncertain/30 hover:border-uncertain"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <span
                        className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          isSpoof
                            ? "bg-spoof/20 text-spoof"
                            : isBonafide
                            ? "bg-bonafide/20 text-bonafide"
                            : "bg-uncertain/20 text-uncertain"
                        }`}
                      >
                        {item.verdict} ({item.confidence}%)
                      </span>
                      <Barcode value={item.id} height={14} showText={false} />
                    </div>

                    <h3 className="font-display font-black text-lg uppercase tracking-tight text-white mt-4 truncate">
                      {item.filename}
                    </h3>

                    <div className="my-3">
                      <MiniWaveform
                        peaks={item.waveform_peaks}
                        verdict={item.verdict}
                        width={240}
                        height={40}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-line flex items-center justify-between font-mono text-[10px] text-muted">
                    <span>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => openInAnalyzer(item)}
                      className="text-bonafide hover:underline flex items-center gap-1 font-bold"
                    >
                      <span>Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
