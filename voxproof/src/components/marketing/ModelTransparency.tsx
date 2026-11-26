"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { ModelInfoResponse } from "@/lib/api/types";
import { Barcode } from "../common/Barcode";
import { ShieldCheck, Cpu, Database, AlertCircle } from "lucide-react";

export const ModelTransparency: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);

  useEffect(() => {
    api.getModelInfo().then(setModelInfo).catch(() => {});
  }, []);

  return (
    <section
      id="model-transparency"
      className="w-full bg-paper text-paper-ink py-28 border-b border-line select-none transition-colors"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between pb-12 border-b border-paper-ink/15 gap-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-paper-ink/60 block mb-2">
              // 07. AUDIT & TRANSPARENCY
            </span>
            <h2 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter leading-[0.9]">
              FORMAL MODEL <br />
              <span className="font-accent italic lowercase tracking-normal font-normal text-paper-ink">
                specification
              </span>{" "}
              CARD.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <Barcode value="VX-MODEL-CARD-22K" height={22} showText={false} />
            <span className="font-mono text-xs uppercase tracking-widest text-paper-ink/70">
              Fetched via GET /api/model-info
            </span>
          </div>
        </div>

        {/* 4-Column Specification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-14 border-b border-paper-ink/15">
          {/* Card 1: Architecture */}
          <div className="flex flex-col justify-between p-6 rounded-card bg-paper-ink/5 border border-paper-ink/10 h-72">
            <div>
              <div className="flex items-center gap-2 text-paper-ink/70 mb-3">
                <Cpu className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
                  Neural Architecture
                </span>
              </div>
              <h3 className="font-display font-black text-2xl uppercase tracking-tight">
                {modelInfo?.name || "AudioCNN-22k"}
              </h3>
              <p className="font-mono text-xs text-paper-ink/70 mt-2 leading-relaxed">
                {modelInfo?.architecture ||
                  "3-Block Convolutional Neural Network with Adaptive Average Pooling"}
              </p>
            </div>
            <div className="pt-4 border-t border-paper-ink/10 font-mono text-xs text-paper-ink/80 flex justify-between">
              <span>Weights:</span>
              <span className="font-bold">
                {modelInfo?.parameters
                  ? `${modelInfo.parameters.toLocaleString()} parameters`
                  : "24,305 parameters"}
              </span>
            </div>
          </div>

          {/* Card 2: Acoustic LFCC Parameters */}
          <div className="flex flex-col justify-between p-6 rounded-card bg-paper-ink/5 border border-paper-ink/10 h-72">
            <div>
              <div className="flex items-center gap-2 text-paper-ink/70 mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
                  LFCC Parameters
                </span>
              </div>
              <div className="flex flex-col gap-1.5 font-mono text-xs text-paper-ink/80">
                <div className="flex justify-between">
                  <span>Sample Rate:</span>
                  <span className="font-bold">
                    {modelInfo?.lfcc.sample_rate ?? 16000} Hz
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Filterbank Bins:</span>
                  <span className="font-bold">
                    {modelInfo?.lfcc.n_filters ?? 60} Bands
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Window Length:</span>
                  <span className="font-bold">
                    {modelInfo?.lfcc.window_length_ms ?? 25} ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Hop Stride:</span>
                  <span className="font-bold">
                    {modelInfo?.lfcc.hop_length_ms ?? 10} ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>FFT Size:</span>
                  <span className="font-bold">
                    {modelInfo?.lfcc.n_fft ?? 512} points
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-paper-ink/10 font-mono text-xs text-paper-ink/80 flex justify-between">
              <span>Dynamic Deltas:</span>
              <span className="font-bold">
                {modelInfo?.lfcc.include_deltas ? "Enabled" : "Disabled (Static 60)"}
              </span>
            </div>
          </div>

          {/* Card 3: Training Datasets */}
          <div className="flex flex-col justify-between p-6 rounded-card bg-paper-ink/5 border border-paper-ink/10 h-72">
            <div>
              <div className="flex items-center gap-2 text-paper-ink/70 mb-3">
                <Database className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
                  Training Ground Truth
                </span>
              </div>
              <h3 className="font-display font-black text-xl uppercase tracking-tight">
                {modelInfo?.training.dataset || "ASVspoof 2019 LA"}
              </h3>
              <p className="font-mono text-xs text-paper-ink/70 mt-2">
                Subsets: {modelInfo?.training.subsets.join(", ") || "train, dev"}
              </p>
              <div className="mt-3 flex flex-col gap-1 font-mono text-xs text-paper-ink/80">
                <div className="flex justify-between">
                  <span>Bonafide samples:</span>
                  <span className="font-bold">
                    {modelInfo?.training.bona_fide_samples?.toLocaleString() ?? "2,580"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Spoofed samples:</span>
                  <span className="font-bold">
                    {modelInfo?.training.spoofed_samples?.toLocaleString() ?? "22,800"}
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-paper-ink/10 font-mono text-xs text-paper-ink/80 flex justify-between">
              <span>Class Ratio:</span>
              <span className="font-bold">1 : 8.8 Imbalance Normalized</span>
            </div>
          </div>

          {/* Card 4: Verified Metrics */}
          <div className="flex flex-col justify-between p-6 rounded-card bg-paper-ink/5 border border-paper-ink/10 h-72">
            <div>
              <div className="flex items-center gap-2 text-paper-ink/70 mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
                  Calibration Metrics
                </span>
              </div>
              {modelInfo?.metrics ? (
                <div className="flex flex-col gap-2 font-mono text-xs text-paper-ink/80">
                  <div className="flex justify-between">
                    <span>Equal Error Rate (EER):</span>
                    <span className="font-bold">
                      {modelInfo.metrics.eer_percent}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min t-DCF:</span>
                    <span className="font-bold">
                      {modelInfo.metrics.min_t_dc}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Accuracy (Dev):</span>
                    <span className="font-bold">
                      {modelInfo.metrics.accuracy_percent}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-paper-ink/10 border border-paper-ink/20 font-mono text-xs text-paper-ink/60 text-center">
                  [Metrics Unprovided by Endpoint - Placeholder]
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-paper-ink/10 font-mono text-[10px] text-paper-ink/60">
              Evaluated strictly on independent development partition.
            </div>
          </div>
        </div>

        {/* Known Limitations */}
        <div className="pt-10 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-paper-ink/80 font-mono text-xs font-bold uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-spoof" />
            <span>Documented Acoustic Limitations & Domain Boundaries</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs text-paper-ink/80 leading-relaxed">
            {modelInfo?.limitations?.map((lim, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-paper-ink/5 border border-paper-ink/10">
                <span className="font-bold text-paper-ink block mb-1">
                  0{idx + 1}. Boundary Constraint
                </span>
                {lim}
              </div>
            )) || (
              <p className="text-paper-ink/60">Loading documented limitations...</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
