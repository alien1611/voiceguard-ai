"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import { Barcode } from "../common/Barcode";
import {
  Mic,
  Clock,
  Layers,
  FileText,
  Key,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Search,
  Bell,
  Download,
  Activity,
} from "lucide-react";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { label: "Analyze", href: "/analyze", icon: Mic },
    { label: "History", href: "/history", icon: Clock },
    { label: "Batch", href: "/batch", icon: Layers },
    { label: "Reports", href: "/history", icon: FileText },
    { label: "API Keys", href: "/#api-access", icon: Key },
    { label: "Settings", href: "/analyze", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-ink text-white flex overflow-hidden">
      {/* 240px Collapsible Left Sidebar */}
      <aside
        className={`relative z-40 bg-ink-2 border-r border-line flex flex-col justify-between transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-60"
        } hidden md:flex shrink-0`}
      >
        {/* Top Logo & Brand */}
        <div className="p-5 border-b border-line flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ink-3 border border-line flex items-center justify-center font-display font-black text-sm text-bonafide">
              VX
            </div>
            {!isCollapsed && (
              <span className="font-display font-black tracking-tight text-lg text-white">
                {siteConfig.name}
              </span>
            )}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-md hover:bg-ink-3 text-muted hover:text-white transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation items */}
        <div className="p-3 flex-1 flex flex-col gap-1">
          {!isCollapsed && (
            <span className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              Forensic Suite
            </span>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono tracking-wider uppercase transition-all ${
                  isActive
                    ? "bg-ink-3 text-bonafide border border-line font-bold"
                    : "text-muted hover:text-white hover:bg-ink-3/50"
                }`}
                title={item.label}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-bonafide" : "text-muted"}`} />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Usage Meter & User Chip */}
        <div className="p-4 border-t border-line flex flex-col gap-4">
          {!isCollapsed && (
            <div className="p-3 rounded-xl bg-ink-3/60 border border-line flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono text-[10px] text-muted uppercase">
                <span>Model Load</span>
                <span className="text-bonafide">AudioCNN 22k</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-ink overflow-hidden">
                <div className="w-2/3 h-full bg-bonafide rounded-full" />
              </div>
              <div className="flex items-center justify-between font-mono text-[9px] text-muted">
                <span>16 kHz Mono</span>
                <span>Sub-150ms</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-line flex items-center justify-center font-mono text-xs text-white shrink-0">
              FX
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="font-mono text-xs font-bold text-white truncate">
                  Forensic Station #01
                </span>
                <span className="font-mono text-[10px] text-muted truncate">
                  Local Memory Mode
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 h-16 bg-ink/90 backdrop-blur-md border-b border-line px-4 sm:px-8 flex items-center justify-between shrink-0">
          {/* Search Bar */}
          <div className="relative w-72 sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search analyses, hashes, audio tags..."
              className="w-full h-9 pl-9 pr-4 rounded-full bg-ink-2 border border-line text-xs font-mono text-white placeholder:text-muted/60 focus:outline-none focus:border-bonafide"
            />
          </div>

          {/* Top Right Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-ink-2 hover:bg-ink-3 border border-line text-xs font-mono uppercase text-muted hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </Link>

            <button
              className="p-2 rounded-full hover:bg-ink-3 text-muted hover:text-white transition-colors relative"
              aria-label="System notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-bonafide" />
            </button>

            <Link
              href="/"
              className="px-3 py-1 rounded-full bg-ink-3 border border-line font-mono text-[10px] uppercase text-muted hover:text-white"
            >
              Exit to Web
            </Link>
          </div>
        </header>

        {/* Sub-view Content */}
        <main className="flex-1 p-4 sm:p-8 flex flex-col">{children}</main>
      </div>
    </div>
  );
};
