import React from "react";
import { Preloader } from "@/components/marketing/Preloader";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { Hero } from "@/components/marketing/Hero";
import { ManifestoStrip } from "@/components/marketing/ManifestoStrip";
import { InlineDemo } from "@/components/marketing/InlineDemo";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { AttackTypes } from "@/components/marketing/AttackTypes";
import { ModelTransparency } from "@/components/marketing/ModelTransparency";
import { UseCases } from "@/components/marketing/UseCases";
import { MarketingFooter } from "@/components/layout/MarketingFooter";

export default function MarketingPage() {
  return (
    <div className="relative min-h-screen bg-ink text-white flex flex-col">
      {/* 00 Preloader */}
      <Preloader />

      {/* 01 Nav */}
      <MarketingNav />

      {/* Main Sections */}
      <main className="flex-1 flex flex-col">
        {/* 02 Hero */}
        <Hero />

        {/* 03 Manifesto Strip */}
        <ManifestoStrip />

        {/* 04 Inline Demo */}
        <InlineDemo />

        {/* 05 How It Works */}
        <HowItWorks />

        {/* 06 Attack Types */}
        <AttackTypes />

        {/* 07 Model Transparency (Paper Background) */}
        <ModelTransparency />

        {/* 08 Use Cases */}
        <UseCases />
      </main>

      {/* 09 CTA + Footer */}
      <MarketingFooter />
    </div>
  );
}
