"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { api } from "@/lib/api/client";
import { HealthResponse } from "@/lib/api/types";
import { ArrowUpRight } from "lucide-react";

export const MarketingNav: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    // Health polling
    api.checkHealth().then(setHealth).catch(() => {});
    const interval = setInterval(() => {
      api.checkHealth().then(setHealth).catch(() => {});
    }, 15000);

    // Scroll hide/show behavior
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 100) {
        if (currentScrollY > lastScrollY && currentScrollY - lastScrollY > 6) {
          setIsVisible(false); // Scrolling down
        } else if (lastScrollY - currentScrollY > 6) {
          setIsVisible(true); // Scrolling up
        }
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearInterval(interval);
    };
  }, [lastScrollY]);

  const isModelOnline = health?.status === "healthy";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      } backdrop-blur-md bg-ink/75 border-b border-line`}
    >
      <nav
        className="max-w-[1440px] mx-auto px-4 sm:px-8 h-20 flex items-center justify-between"
        aria-label="Main Navigation"
      >
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-bonafide rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-ink-3 border border-line flex items-center justify-center font-display font-black text-sm text-bonafide group-hover:border-bonafide transition-colors">
            VX
          </div>
          <span className="font-display font-black tracking-tight text-xl text-white">
            {siteConfig.name}
          </span>
        </Link>

        {/* Center Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {siteConfig.navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs font-mono uppercase tracking-[0.14em] text-muted hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Status & CTA */}
        <div className="flex items-center gap-4">
          {/* Health Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-ink-2 border border-line">
            <span
              className={`w-2 h-2 rounded-full ${
                isModelOnline
                  ? "bg-bonafide animate-pulse"
                  : "bg-spoof"
              }`}
            />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              {isModelOnline ? "Model Online" : "Model Offline"}
            </span>
          </div>

          {/* White Pill CTA */}
          <Link
            href="/analyze"
            data-cursor="ANALYZE"
            className="px-5 py-2.5 rounded-full bg-white text-ink font-mono text-xs uppercase font-bold tracking-wider hover:bg-bonafide hover:text-ink transition-all duration-200 flex items-center gap-2 active:scale-95"
          >
            <span>Analyze Audio</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
};
