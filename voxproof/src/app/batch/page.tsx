"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api/client";
import { AnalysisResult } from "@/lib/api/types";
import { Barcode } from "@/components/common/Barcode";
import {
  UploadCloud,
  Download,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  FileAudio,
} from "lucide-react";

interface BatchItem {
  file: File;
  status: "queued" | "processing" | "done" | "error";
  result?: AnalysisResult;
  error?: string;
}

export default function BatchPage() {
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sortField, setSortField] = useState<"name" | "score" | "verdict">("score");
  const [sortAsc, setSortAsc] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: BatchItem[] = Array.from(files).map((f) => ({
      file: f,
      status: "queued",
    }));
    setQueue((prev) => [...prev, ...newItems]);
  };

  const runBatch = async () => {
    if (isRunning || queue.length === 0) return;
    setIsRunning(true);

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "done") continue;

      // Update to processing
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "processing" } : item
        )
      );

      try {
        const res = await api.analyzeFile(queue[i].file);
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "done", result: res } : item
          )
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "error", error: err.message } : item
          )
        );
      }
    }

    setIsRunning(false);
  };

  const exportCsv = () => {
    const rows = [
      ["Analysis ID", "Filename", "Verdict", "Spoof Score", "Confidence", "Latency (ms)"],
      ...queue
        .filter((q) => q.result)
        .map((q) => [
          q.result!.id,
          q.result!.filename,
          q.result!.verdict.toUpperCase(),
          q.result!.score.toFixed(4),
          `${q.result!.confidence}%`,
          q.result!.timings_ms.total.toString(),
        ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `voxproof_batch_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort queue
  const sortedQueue = [...queue].sort((a, b) => {
    if (sortField === "name") {
      return sortAsc
        ? a.file.name.localeCompare(b.file.name)
        : b.file.name.localeCompare(a.file.name);
    }
    if (sortField === "score") {
      const scoreA = a.result?.score ?? -1;
      const scoreB = b.result?.score ?? -1;
      return sortAsc ? scoreA - scoreB : scoreB - scoreA;
    }
    if (sortField === "verdict") {
      const vA = a.result?.verdict ?? "";
      const vB = b.result?.verdict ?? "";
      return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    return 0;
  });

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-8 select-none pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between pb-6 border-b border-line gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-bonafide block mb-1">
              // HIGH-THROUGHPUT DISPATCH
            </span>
            <h1 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight text-white">
              Batch Verification Engine
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {queue.some((q) => q.result) && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-ink-2 hover:bg-ink-3 border border-line text-xs font-mono uppercase text-white transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}

            {queue.length > 0 && (
              <button
                onClick={() => setQueue([])}
                className="px-4 py-2 rounded-full bg-ink-2 hover:bg-spoof/20 text-muted hover:text-spoof border border-line text-xs font-mono uppercase transition-colors"
              >
                Clear Queue
              </button>
            )}
          </div>
        </div>

        {/* Multi-file Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="relative w-full rounded-card border-2 border-dashed border-line hover:border-bonafide bg-ink-2 p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[180px]"
        >
          <input
            type="file"
            multiple
            accept=".wav,.mp3,.flac,.ogg,.m4a"
            onChange={(e) => handleFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <UploadCloud className="w-8 h-8 text-bonafide" />
            <span className="font-mono text-xs uppercase font-bold text-white">
              Drop Multiple Audio Targets Here Or Click To Browse
            </span>
            <span className="font-mono text-[10px] text-muted">
              WAV, MP3, FLAC · Up to 50 concurrent audio targets
            </span>
          </div>
        </div>

        {/* Queue Actions */}
        {queue.length > 0 && (
          <div className="flex items-center justify-between bg-ink-2 p-4 rounded-2xl border border-line">
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="text-white font-bold">
                {queue.length} Total Targets
              </span>
              <span>·</span>
              <span className="text-bonafide">
                {queue.filter((q) => q.status === "done").length} Processed
              </span>
              <span>·</span>
              <span className="text-muted">
                {queue.filter((q) => q.status === "queued").length} Queued
              </span>
            </div>

            <button
              onClick={runBatch}
              disabled={isRunning || queue.every((q) => q.status === "done")}
              className="px-6 py-2.5 rounded-full bg-white text-ink hover:bg-bonafide font-mono text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? "Running Batch..." : "Execute Queue"}</span>
            </button>
          </div>
        )}

        {/* Results Table */}
        {queue.length > 0 && (
          <div className="rounded-2xl bg-ink-2 border border-line overflow-hidden">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-ink-3/80 border-b border-line text-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th
                    className="p-4 cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField("name");
                      setSortAsc(!sortAsc);
                    }}
                  >
                    Target Filename
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField("verdict");
                      setSortAsc(!sortAsc);
                    }}
                  >
                    Verdict
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField("score");
                      setSortAsc(!sortAsc);
                    }}
                  >
                    Spoof Likelihood
                  </th>
                  <th className="p-4">Confidence</th>
                  <th className="p-4">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sortedQueue.map((item, idx) => {
                  const isDone = item.status === "done";
                  const isProcessing = item.status === "processing";
                  const res = item.result;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-ink-3/30 transition-colors"
                    >
                      <td className="p-4 flex items-center gap-2.5 text-white font-bold">
                        <FileAudio className="w-4 h-4 text-muted shrink-0" />
                        <span className="truncate max-w-xs">{item.file.name}</span>
                      </td>

                      <td className="p-4">
                        {isDone && res ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full uppercase text-[10px] font-bold ${
                              res.verdict === "spoof"
                                ? "bg-spoof/20 text-spoof"
                                : res.verdict === "bonafide"
                                ? "bg-bonafide/20 text-bonafide"
                                : "bg-uncertain/20 text-uncertain"
                            }`}
                          >
                            {res.verdict}
                          </span>
                        ) : isProcessing ? (
                          <span className="text-bonafide animate-pulse text-[10px]">
                            Processing...
                          </span>
                        ) : (
                          <span className="text-muted text-[10px]">Queued</span>
                        )}
                      </td>

                      <td className="p-4">
                        {isDone && res ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-ink overflow-hidden">
                              <div
                                className="h-full bg-bonafide rounded-full"
                                style={{ width: `${res.score * 100}%` }}
                              />
                            </div>
                            <span className="text-white">
                              {res.score.toFixed(3)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="p-4">
                        {isDone && res ? (
                          <span className="text-white font-bold">
                            {res.confidence}%
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="p-4 text-muted">
                        {isDone && res ? `${res.timings_ms.total}ms` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
