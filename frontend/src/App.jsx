import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import Detector from './components/Detector';
import RecordView from './components/RecordView';
import LiveDetectionView from './components/LiveDetectionView';
import HistoryView from './components/HistoryView';
import ModelInfoModal from './components/ModelInfoModal';
import { checkHealth, getModelInfo, checkDatabaseHealth } from './services/api';
import { 
  Shield, 
  LayoutDashboard, 
  FileCheck2, 
  Mic,
  Radio,
  Clock, 
  Cpu, 
  Menu, 
  X, 
  Info,
  Waves,
  Activity,
  Layers
} from 'lucide-react';

export default function App() {
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      if (t === 'detector' || t === 'verify') return 'detector';
      if (t === 'record') return 'record';
      if (t === 'live') return 'live';
      if (t === 'history') return 'history';
      if (t === 'overview') return 'overview';
    }
    return 'overview';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [backendHealth, setBackendHealth] = useState(null);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const [dbHealth, setDbHealth] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isModelInfoModalOpen, setIsModelInfoModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Health and Model Info polling
  const refreshBackendStatus = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const [health, database] = await Promise.allSettled([
        checkHealth(),
        checkDatabaseHealth(),
      ]);

      if (health.status === 'fulfilled') {
        setBackendHealth(health.value);
      } else {
        setBackendHealth({
          status: 'degraded',
          model_loaded: false,
          device: 'unknown',
          uptime_seconds: 0,
        });
      }

      if (database.status === 'fulfilled') {
        setDbHealth(database.value);
      } else {
        setDbHealth({ connected: false, status: 'unavailable', ping_ms: null });
      }

      if (!modelInfo) {
        const info = await getModelInfo().catch(() => null);
        if (info) setModelInfo(info);
      }
    } catch {
      setBackendHealth({
        status: 'degraded',
        model_loaded: false,
        device: 'unknown',
        uptime_seconds: 0,
      });
      setDbHealth({ connected: false, status: 'unavailable', ping_ms: null });
    } finally {
      setIsCheckingHealth(false);
    }
  }, [modelInfo]);

  useEffect(() => {
    refreshBackendStatus();
    const interval = setInterval(refreshBackendStatus, 15000);
    return () => clearInterval(interval);
  }, [refreshBackendStatus]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, tag: '01' },
    { id: 'detector', label: 'Verify Audio', icon: FileCheck2, tag: '02' },
    { id: 'record', label: 'Record Audio', icon: Mic, tag: '03' },
    { id: 'live', label: 'Live Detection', icon: Radio, tag: '04' },
    { id: 'history', label: 'Detection History', icon: Clock, tag: '05' },
  ];

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Acoustic Defense Overview';
      case 'detector': return 'Acoustic Verification';
      case 'record': return 'Studio Voice Capture';
      case 'live': return 'Real-Time Streaming Monitor';
      case 'history': return 'Verification Audit Archive';
      default: return 'VoiceGuard AI';
    }
  };

  const isHealthy = backendHealth?.status === 'healthy';

  return (
    <div className="min-h-screen bg-bg-main flex flex-col md:flex-row font-sans text-espresso selection:bg-brand-terracotta/20 selection:text-espresso">
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden flex items-center justify-between px-5 py-3.5 sidebar-dark-cream border-b border-[#D6C8B5] shadow-soft">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-md bg-brand-primary text-bg-surface flex items-center justify-center font-serif text-base font-bold shadow-soft">
            V
          </div>
          <div>
            <span className="font-serif font-bold text-base text-espresso tracking-tight">VoiceGuard</span>
            <span className="text-[10px] text-espresso-secondary ml-1.5 font-mono uppercase tracking-wider">AI Lab</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded text-espresso-secondary hover:text-espresso hover:bg-white/60"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Persistent Left Architectural Spine */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 sidebar-dark-cream border-r border-[#D6C8B5] flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="px-6 py-6 border-b border-[#D6C8B5] hidden md:block">
            <div className="flex items-center space-x-3.5">
              <div className="w-9 h-9 rounded-md bg-brand-primary text-bg-surface flex items-center justify-center shadow-card font-serif font-bold text-lg">
                V
              </div>
              <div>
                <h1 className="font-serif font-bold text-base text-espresso tracking-tight leading-tight">
                  VoiceGuard AI
                </h1>
                <p className="text-[10px] text-espresso-secondary uppercase tracking-widest font-mono mt-0.5">
                  Micro-Acoustic Defense
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="p-4 space-y-1.5">
            <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-espresso-muted font-mono">
              Laboratory Suite
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`sidebar-nav-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs relative group ${
                    isActive
                      ? 'bg-[#FFFDF9] text-brand-deep font-semibold shadow-soft border border-[#D6C8B5]'
                      : 'text-espresso-secondary hover:bg-white/70 hover:text-espresso font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-brand-terracotta' : 'text-espresso-secondary group-hover:text-espresso'}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${isActive ? 'text-brand-terracotta font-bold' : 'text-espresso-muted'}`}>
                    {item.tag}
                  </span>
                  {isActive && (
                    <span className="w-1 h-4 bg-brand-terracotta rounded-r-full absolute left-0 top-1/2 -translate-y-1/2" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer & Diagnostic Telemetry */}
        <div className="p-4 border-t border-[#D6C8B5] bg-black/5 space-y-3">
          {/* Model Specification Trigger */}
          <button
            onClick={() => setIsModelInfoModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs text-espresso-secondary hover:text-espresso hover:bg-[#FFFDF9] border border-transparent hover:border-[#D6C8B5] transition-all font-mono"
            title="Inspect model weights and parameters"
          >
            <div className="flex items-center space-x-2">
              <Cpu className="w-3.5 h-3.5 text-brand-caramel" />
              <span>Model Specs</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-espresso-secondary border border-border-subtle font-mono">
              23.4k
            </span>
          </button>

          {/* Service Readiness Status */}
          <div className="px-3 py-2 rounded bg-[#FFFDF9] border border-[#D6C8B5] flex items-center justify-between text-[11px] font-mono shadow-soft">
            <span className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-bonafide animate-pulse' : 'bg-warning'}`} />
              <span className="text-espresso font-medium">{isHealthy ? 'CNN Active' : 'Degraded'}</span>
            </span>
            <span className="text-espresso-muted text-[10px]">16 kHz</span>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-bg-surface/90 backdrop-blur-md border-b border-border-subtle px-6 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-mono text-espresso-secondary">VoiceGuard</span>
            <span className="text-espresso-muted">/</span>
            <span className="font-medium text-espresso">{getPageTitle()}</span>
          </div>
        </header>

        {/* Main Work Area */}
        <main className="flex-1 p-6 sm:p-10 max-w-6xl w-full mx-auto">
          {activeTab === 'overview' && (
            <Dashboard
              onStartDetection={() => setActiveTab('detector')}
              onStartRecord={() => setActiveTab('record')}
              onStartLive={() => setActiveTab('live')}
              backendHealth={backendHealth}
              modelInfo={modelInfo}
              onOpenModelInfo={() => setIsModelInfoModalOpen(true)}
            />
          )}

          {activeTab === 'detector' && (
            <Detector backendHealth={backendHealth} />
          )}

          {activeTab === 'record' && (
            <RecordView backendHealth={backendHealth} />
          )}

          {activeTab === 'live' && (
            <LiveDetectionView backendHealth={backendHealth} />
          )}

          {activeTab === 'history' && (
            <HistoryView onNavigateToDetector={() => setActiveTab('detector')} />
          )}
        </main>
      </div>

      {/* Model Specifications Modal */}
      <ModelInfoModal
        isOpen={isModelInfoModalOpen}
        onClose={() => setIsModelInfoModalOpen(false)}
        modelInfo={modelInfo}
      />
    </div>
  );
}
