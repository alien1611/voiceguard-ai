"use client";

import React, { useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Marquee } from "../common/Marquee";
import { GiantWordmark } from "../common/GiantWordmark";
import { Barcode } from "../common/Barcode";
import { ArrowRight, Check } from "lucide-react";

export const MarketingFooter: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setTimeout(() => {
      setEmail("");
      setSubmitted(false);
    }, 4000);
  };

  return (
    <footer id="api-access" className="w-full bg-ink text-white pt-20 border-t border-line">
      {/* Marquee strip */}
      <Marquee speed="36s" />

      {/* CTA Box */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-bonafide mb-4 block">
              // 09. ENTERPRISE INTEGRATION
            </span>
            <h2 className="font-display font-black text-4xl sm:text-6xl md:text-7xl uppercase tracking-tighter leading-[0.9]">
              REQUEST FORENSIC <br />
              <span className="text-bonafide font-accent italic font-normal lowercase tracking-normal">
                api
              </span>{" "}
              ACCESS.
            </h2>
            <p className="mt-6 text-muted text-base max-w-xl">
              High-throughput asynchronous inference endpoint. Standardized LFCC
              feature extraction, sub-100ms model latency, zero audio data
              retention guarantees.
            </p>
          </div>

          <div className="lg:col-span-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label
                htmlFor="api-email"
                className="font-mono text-xs uppercase tracking-widest text-muted"
              >
                Developer / Security Team Email
              </label>
              <div className="relative flex items-center">
                <input
                  id="api-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="security@enterprise.com"
                  required
                  className="w-full h-14 pl-5 pr-32 rounded-full bg-ink-2 border border-line text-white placeholder:text-muted/50 focus:outline-none focus:border-bonafide focus:ring-1 focus:ring-bonafide font-mono text-xs"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 px-6 rounded-full bg-white text-ink font-mono text-xs font-bold uppercase tracking-wider hover:bg-bonafide transition-colors flex items-center gap-2"
                >
                  {submitted ? (
                    <>
                      <Check className="w-4 h-4 text-ink" />
                      <span>Received</span>
                    </>
                  ) : (
                    <>
                      <span>Join Queue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
              <span className="font-mono text-[10px] text-muted tracking-wide mt-1">
                {siteConfig.retentionPolicy}
              </span>
            </form>
          </div>
        </div>
      </div>

      {/* Giant Split Wordmark */}
      <div className="px-4 sm:px-8">
        <GiantWordmark />
      </div>

      {/* Sub-footer Bar */}
      <div className="border-t border-line py-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Barcode value="VX-SYS-2026-AUTH" height={22} showText={false} />
            <span className="font-mono text-xs text-muted">
              © {new Date().getFullYear()} {siteConfig.name} LABS. ZERO PERSISTENCE.
            </span>
          </div>

          <div className="flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-muted">
            <Link href="/analyze" className="hover:text-white transition-colors">
              Console
            </Link>
            <Link href="/history" className="hover:text-white transition-colors">
              Telemetry
            </Link>
            <Link href="/batch" className="hover:text-white transition-colors">
              Batch
            </Link>
            <span className="text-line">|</span>
            <span className="hover:text-white cursor-pointer transition-colors">
              Privacy
            </span>
            <span className="hover:text-white cursor-pointer transition-colors">
              Terms
            </span>
            <span className="hover:text-white cursor-pointer transition-colors">
              Docs
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
