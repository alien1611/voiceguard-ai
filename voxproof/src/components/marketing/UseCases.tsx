"use client";

import React from "react";
import { Barcode } from "../common/Barcode";
import { PhoneCall, Newspaper, UserCheck, Scale, ArrowUpRight } from "lucide-react";

interface UseCaseItem {
  num: string;
  title: string;
  domain: string;
  description: string;
  icon: React.ElementType;
  metric: string;
}

const cases: UseCaseItem[] = [
  {
    num: "01",
    title: "Call-Center Fraud & Voice Phishing",
    domain: "Banking & Financial Services",
    description:
      "Real-time interception of social engineering attacks and AI voice spoofing over IVR and customer support lines. Stops unauthorized wire transfers before execution.",
    icon: PhoneCall,
    metric: "<150ms Telephony Inline Latency",
  },
  {
    num: "02",
    title: "Newsroom & Editorial Verification",
    domain: "Investigative Journalism & Media",
    description:
      "Rapid triage of leaked audio recordings, whistleblowing submissions, and election-cycle deepfakes. Verifies acoustic authenticity prior to publication.",
    icon: Newspaper,
    metric: "Frame-Level Forensic Explainability",
  },
  {
    num: "03",
    title: "Voice-Biometric Onboarding",
    domain: "Enterprise Identity & Access",
    description:
      "Anti-spoofing liveness layer for voice-based KYC and biometric authentication. Prevents presentation attacks using pre-recorded or cloned samples.",
    icon: UserCheck,
    metric: "Zero False-Acceptance at 0.50 Threshold",
  },
  {
    num: "04",
    title: "Legal & Forensic Audio Review",
    domain: "Judicial Proceedings & Defense",
    description:
      "Verifiable chain-of-custody analysis for audio introduced as courtroom evidence. Generates comprehensive technical audits with Grad-CAM saliency maps.",
    icon: Scale,
    metric: "Cryptographic SHA-256 Audit Trail",
  },
];

export const UseCases: React.FC = () => {
  return (
    <section className="w-full bg-ink py-28 border-b border-line select-none">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between pb-12 border-b border-line gap-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-bonafide block mb-3">
              // 08. DEPLOYMENT APPLICATIONS
            </span>
            <h2 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter leading-[0.9] text-white">
              CRITICAL FORENSIC <br />
              <span className="font-accent italic text-bonafide lowercase font-normal tracking-normal">
                use
              </span>{" "}
              ENVIRONMENTS.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <Barcode value="VX-DEPLOY-V4" height={20} showText={false} />
            <span className="font-mono text-xs text-muted uppercase tracking-wider">
              Zero-Cloud Egress
            </span>
          </div>
        </div>

        {/* 4 Large Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12">
          {cases.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.num}
                data-cursor="VIEW"
                className="group p-8 rounded-card bg-ink-2 border border-line hover:border-bonafide transition-all duration-300 flex flex-col justify-between h-[360px] relative overflow-hidden shadow-xl hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between pb-6 border-b border-line">
                    <span className="font-mono text-xs text-muted group-hover:text-bonafide transition-colors">
                      {item.num} // {item.domain}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-ink-3 border border-line flex items-center justify-center text-muted group-hover:text-bonafide group-hover:border-bonafide transition-all">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-white mt-6 group-hover:text-bonafide transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-muted text-sm mt-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-6 border-t border-line flex items-center justify-between">
                  <span className="font-mono text-xs text-bonafide uppercase tracking-wider font-bold">
                    {item.metric}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-bonafide group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
