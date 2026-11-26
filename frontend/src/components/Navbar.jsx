import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity, Cpu, RefreshCw, Info, Database } from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  backendHealth, 
  dbHealth,
  isCheckingHealth, 
  onRefreshHealth,
  onOpenModelInfo 
}) {
  const isHealthy = backendHealth?.status === 'healthy';

  return (
    <header className="sticky top-0 z-50 bg-navy-900/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 transition-colors shadow-sm shadow-cyan-950">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                  VoiceGuard <span className="text-cyan-400">AI</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
                  v1.0 Local
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Acoustic LFCC &amp; CNN Voice Spoof Detector</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('detector')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'detector'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Voice Analysis
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'architecture'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Architecture
            </button>
          </nav>

          {/* Backend Status & Model Info Button */}
          <div className="flex items-center space-x-3">
            {/* Local MongoDB Indicator */}
            <div 
              className={`hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono border transition-all ${
                dbHealth?.connected
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
              title={
                dbHealth?.connected
                  ? `MongoDB local on 127.0.0.1:27017 (Ping: ${dbHealth.ping_ms !== null ? dbHealth.ping_ms.toFixed(1) : 0}ms)`
                  : 'MongoDB is offline (History disabled)'
              }
            >
              <Database className="w-3 h-3 text-cyan-400" />
              <span>{dbHealth?.connected ? 'DB: Online' : 'DB: Offline'}</span>
            </div>

            {/* Live Backend Indicator */}
            <div 
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${
                isHealthy
                  ? 'bg-teal-950/40 border-teal-500/40 text-teal-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
              title={
                isHealthy 
                  ? `Backend healthy on ${backendHealth.device.toUpperCase()} (Uptime: ${backendHealth.uptime_seconds}s)`
                  : 'Backend is offline or unreachable on http://127.0.0.1:8000'
              }
            >
              <span className="relative flex h-2 w-2">
                {isHealthy && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-teal-400' : 'bg-rose-500'}`}></span>
              </span>
              <span className="hidden sm:inline">
                {isHealthy ? `Backend: ${backendHealth.device.toUpperCase()}` : 'Backend: Offline'}
              </span>
              <button 
                onClick={onRefreshHealth}
                disabled={isCheckingHealth}
                aria-label="Refresh backend status"
                className="hover:text-white transition-transform hover:rotate-180 duration-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Model Info Specs Trigger */}
            <button
              onClick={onOpenModelInfo}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
              title="View CNN Model & LFCC Architecture Specs"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">Model Specs</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
