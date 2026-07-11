'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ExternalLink, 
  RefreshCw,
  Terminal,
  Cpu,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { AgentState, AgentStep } from '@/lib/agent/types';

// Real-time projected wireframe 3D crystal shard (mathematical rotation, 0 dependencies, 0 disk space)
function Dossier3DShard({ confidence = 85 }: { confidence?: number }) {
  const [angle, setAngle] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Respect user accessibility pref
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    let animId: number;
    const tick = () => {
      // Rotation speed tied to confidence metrics (faster rotation for higher confidence)
      const speed = 0.004 + (confidence / 100) * 0.006;
      setAngle(a => (a + speed) % (Math.PI * 2));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [confidence]);

  if (!mounted) return null;

  // 3D vertices of a double-pyramid crystal shard
  const vertices = [
    { x: 0, y: -45, z: 0 },   // Top
    { x: 0, y: 45, z: 0 },    // Bottom
    { x: 26, y: 0, z: 26 },   // Mid-Front-Right
    { x: -26, y: 0, z: 26 },  // Mid-Front-Left
    { x: -26, y: 0, z: -26 }, // Mid-Back-Left
    { x: 26, y: 0, z: -26 },  // Mid-Back-Right
  ];

  const cosY = Math.cos(angle);
  const sinY = Math.sin(angle);
  const cosX = Math.cos(angle * 0.4);
  const sinX = Math.sin(angle * 0.4);

  const projected = vertices.map(v => {
    // Y-axis rotation
    let x1 = v.x * cosY - v.z * sinY;
    let z1 = v.x * sinY + v.z * cosY;
    
    // X-axis rotation
    let y2 = v.y * cosX - z1 * sinX;
    let z2 = v.y * sinX + z1 * cosX;
    
    // Orthographic projection with depth scale
    const scale = 140 / (140 + z2);
    return {
      x: x1 * scale + 50,
      y: y2 * scale + 50,
      z: z2
    };
  });

  const edges = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 3], [3, 4], [4, 5], [5, 2]
  ];

  return (
    <div className="w-28 h-28 flex items-center justify-center relative select-none">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Alignment guides */}
        <line x1="15" y1="50" x2="85" y2="50" stroke="var(--line)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        <line x1="50" y1="15" x2="50" y2="85" stroke="var(--line)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        
        {/* Shard lines */}
        {edges.map(([p1, p2], idx) => {
          const pt1 = projected[p1];
          const pt2 = projected[p2];
          const avgZ = (pt1.z + pt2.z) / 2;
          const opacity = Math.max(0.1, Math.min(0.85, 0.45 - avgZ / 100));
          
          return (
            <line
              key={idx}
              x1={pt1.x}
              y1={pt1.y}
              x2={pt2.x}
              y2={pt2.y}
              stroke="var(--steel-blue)"
              strokeWidth="0.75"
              strokeOpacity={opacity}
            />
          );
        })}
        
        {/* Nodes highlights */}
        {projected.map((pt, idx) => {
          const size = Math.max(1, Math.min(2.5, 1.8 - pt.z / 60));
          return (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={size}
              fill={idx < 2 ? 'var(--stamp-rose)' : 'var(--steel-blue)'}
            />
          );
        })}
      </svg>
    </div>
  );
}

// SVG Arc/Radial gauge drawing animation
function ConfidenceGauge({ percentage = 85, color = 'var(--stamp-rose)' }: { percentage?: number, color?: string }) {
  const radius = 34;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  // Offset represents the arc unfilled gap (draw 75% circle arc)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (percentage / 100) * arcLength;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center select-none">
      <svg className="w-full h-full transform -rotate-225" viewBox="0 0 80 80">
        {/* Background track */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          opacity="0.3"
        />
        {/* Animated fill indicator */}
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
          strokeLinecap="round"
        />
      </svg>
      {/* Monospace score label centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
        <span className="text-sm font-bold text-paper">{percentage}%</span>
        <span className="text-[7px] text-textDim uppercase tracking-wider">CONFIDENCE</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Researched state cache
  const [companiesList, setCompaniesList] = useState<Record<string, AgentState>>({});
  const [activeCompanyKey, setActiveCompanyKey] = useState<string>('');
  
  // Real-time trace steps
  const [terminalTrace, setTerminalTrace] = useState<AgentStep[]>([]);
  
  // Active navigation section
  const [activeSection, setActiveSection] = useState('overview');

  // References for scroll tracking
  const overviewRef = useRef<HTMLDivElement>(null);
  const financialsRef = useRef<HTMLDivElement>(null);
  const exhibitsRef = useRef<HTMLDivElement>(null);
  const reasoningRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Monitor scrolling to highlight folder rail tabs
  useEffect(() => {
    if (!mounted) return;

    const sections = [
      { id: 'overview', ref: overviewRef },
      { id: 'financials', ref: financialsRef },
      { id: 'exhibits', ref: exhibitsRef },
      { id: 'reasoning', ref: reasoningRef },
      { id: 'sources', ref: sourcesRef }
    ];

    const handleScroll = () => {
      let currentSection = 'overview';
      for (const section of sections) {
        const el = section.ref.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 250) {
            currentSection = section.id;
          }
        }
      }
      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mounted, activeCompanyKey]);

  const activeResult = activeCompanyKey ? companiesList[activeCompanyKey] : null;

  // Suggested case targets
  const quickInputs = [
    { label: 'NVIDIA', ticker: 'NVDA' },
    { label: 'Apple', ticker: 'AAPL' },
    { label: 'Reliance', ticker: 'RELIANCE.NS' },
    { label: 'TCS', ticker: 'TCS.NS' }
  ];

  // Helper to scroll smoothly to ref target
  const scrollToAnchor = (id: string, ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  // Triggers streaming research via Next.js serverless route
  const runResearch = async (query: string) => {
    if (!query.trim()) return;
    
    const upperQuery = query.trim().toUpperCase();

    // Check client-side cache
    if (companiesList[upperQuery]) {
      setActiveCompanyKey(upperQuery);
      setTerminalTrace(companiesList[upperQuery].steps || []);
      setCompanyName('');
      return;
    }

    setLoading(true);
    setError(null);
    setTerminalTrace([]);

    // Step 0: Terminal Initialization message
    const initTimestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setTerminalTrace([
      { node: 'init', status: 'running', message: `Initializing stateful LangGraph compilation for dossier: "${upperQuery}"`, timestamp: initTimestamp }
    ]);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName: query }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to compile dossier file.');
      }

      // Stream Server-Sent Events (SSE)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Stream reader unavailable.');

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          let eventDataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventDataStr = line.slice(6).trim();
            }
          }

          if (eventType === 'state' && eventDataStr) {
            const stateData: AgentState = JSON.parse(eventDataStr);
            const key = stateData.companyName.toUpperCase();
            
            // Append and map streaming trace logs
            setTerminalTrace(stateData.steps || []);
            setCompaniesList(prev => ({
              ...prev,
              [key]: stateData
            }));
            setActiveCompanyKey(key);
          } else if (eventType === 'error' && eventDataStr) {
            const errData = JSON.parse(eventDataStr);
            throw new Error(errData.message || 'Dossier stream error.');
          }
        }
      }

      setCompanyName('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong during research compile.');
      setTerminalTrace(prev => [
        ...prev,
        { node: 'error', status: 'failed', message: err.message || 'Fatal workflow termination.', timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runResearch(companyName);
  };

  const isValValid = (val: string | undefined) => {
    if (!val || val.toLowerCase().includes('unavailable') || val.toLowerCase() === 'n/a') {
      return false;
    }
    return true;
  };

  // Verdict style mappings
  const getVerdictDetails = (decision: string | null) => {
    if (decision === 'INVEST') return { color: 'var(--stamp-rose)', borderClass: 'border-stampRose text-stampRose', label: 'INVEST', confidenceVal: 91 };
    if (decision === 'PASS') return { color: 'var(--muted-rose)', borderClass: 'border-mutedRose text-mutedRose', label: 'PASS', confidenceVal: 84 };
    return { color: 'var(--steel-blue)', borderClass: 'border-steelBlue text-steelBlue', label: 'WATCH', confidenceVal: 50 };
  };

  // Folder navigation rail list
  const navTabs = [
    { id: 'overview', label: 'OVERVIEW', ref: overviewRef },
    { id: 'financials', label: 'FINANCIALS', ref: financialsRef },
    { id: 'exhibits', label: 'EXHIBITS', ref: exhibitsRef },
    { id: 'reasoning', label: 'REASONING', ref: reasoningRef },
    { id: 'sources', label: 'SOURCES', ref: sourcesRef }
  ];

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col md:flex-row relative min-h-0 select-text">
      
      {/* Subtle tactile grain/noise overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025] z-50 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')]" />

      {/* LEFT RAIL / NAVIGATION BAR */}
      <nav className="w-full md:w-[150px] md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-line bg-inkNavy shrink-0 z-20 flex md:flex-col p-4 md:pt-12 select-none overflow-x-auto md:overflow-x-visible">
        
        {/* Holographic Wireframe 3D Shard representation tied to actual data */}
        <div className="hidden md:flex flex-col items-center mb-10 select-none">
          <Dossier3DShard confidence={activeResult ? getVerdictDetails(activeResult.decision).confidenceVal : 75} />
          <div className="flex flex-col gap-0.5 font-mono text-[8px] text-textDim tracking-wider text-center mt-2">
            <span>AUDIT_SHARD_CORE</span>
            <span>ROTATION: SLOW_IDLE</span>
          </div>
        </div>

        {/* Rail navigation tabs */}
        <div className="flex md:flex-col gap-2 md:gap-5 w-full min-w-[400px] md:min-w-0">
          {navTabs.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => scrollToAnchor(tab.id, tab.ref)}
                className={`font-mono text-[10px] tracking-wider text-left py-1 px-3 md:px-0 transition-all duration-150 relative w-full ${
                  isActive 
                    ? 'text-paper font-semibold' 
                    : 'text-textDim hover:text-textMuted'
                }`}
              >
                {isActive && (
                  <span className="hidden md:block absolute left-0 top-1 bottom-1 w-[2px] bg-stampRose animate-pulse" />
                )}
                {isActive && (
                  <span className="md:hidden absolute bottom-0 left-3 right-3 h-[2px] bg-stampRose" />
                )}
                <span className="md:pl-4">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* RIGHT CONTENT COLUMN */}
      <main className="flex-1 flex flex-col p-6 md:p-14 md:max-w-4xl w-full mx-auto relative min-w-0">
        
        {/* Search header container */}
        <div className="border-b border-line pb-8 mb-12">
          <form onSubmit={handleSearchSubmit} className="relative group max-w-xl w-full">
            <div className="relative flex items-center bg-ledgerSurface border border-line rounded px-4 py-2.5 transition-all duration-150">
              <Search className="w-4 h-4 text-textDim mr-3 shrink-0" />
              <input
                type="text"
                className="bg-transparent border-none outline-none text-paper placeholder-textDim w-full text-sm font-sans focus:ring-0 focus:outline-none"
                placeholder="Query stock ticker or name (e.g. AAPL, NVDA)..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit" 
                className="ml-3 px-4 py-1 rounded border border-line hover:border-steelBlue text-xs font-mono text-paleBlue tracking-widest uppercase transition-all duration-150 shrink-0"
                disabled={loading || !companyName.trim()}
              >
                {loading ? 'COMPILING...' : 'COMPILE'}
              </button>
            </div>
          </form>

          {/* Quick-run pills */}
          <div className="flex flex-wrap gap-2 items-center mt-3 text-[9px] font-mono text-textDim uppercase tracking-wider">
            <span>SUGGESTED_DOSSIERS:</span>
            {quickInputs.map((item) => (
              <button
                key={item.ticker}
                onClick={() => {
                  setCompanyName(item.ticker);
                  runResearch(item.ticker);
                }}
                disabled={loading}
                className="px-2 py-0.5 rounded border border-line bg-ledgerSurface/40 hover:border-steelBlue hover:text-paper transition-all duration-150"
              >
                [{item.ticker}]
              </button>
            ))}
          </div>
        </div>

        {/* Main Case file sections list */}
        <AnimatePresence mode="wait">
          {activeResult || loading ? (
            <div className="space-y-16">
              
              {/* SECTION 1: OVERVIEW */}
              <div 
                ref={overviewRef}
                id="overview" 
                className="scroll-mt-12"
              >
                <div className="flex items-center justify-between border-b border-line pb-2 mb-8">
                  <span className="font-mono text-[10px] text-textDim uppercase tracking-[0.18em]">
                    case summary // overview
                  </span>
                  <span className="font-mono text-[9px] text-textDim uppercase tracking-wider">
                    COMPILED: {new Date().toLocaleDateString('en-US')}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-8">
                  {/* Dominant Focal element: Large Verdict Stamp */}
                  <div className="flex items-center gap-6 min-h-[90px]">
                    {activeResult?.decision ? (
                      (() => {
                        const style = getVerdictDetails(activeResult.decision);
                        return (
                          <div className="flex items-center gap-8">
                            {/* Signature Stamp Scale-In spring animation */}
                            <motion.div
                              initial={{ scale: 1.15, rotate: -10 }}
                              animate={{ scale: 1, rotate: -6 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                              className={`border-[2.5px] font-mono text-xl font-bold tracking-[0.15em] px-5 py-2.5 rounded select-none ${style.borderClass}`}
                            >
                              {style.label}
                            </motion.div>
                            
                            {/* Arc Radial Gauge next to stamp */}
                            <ConfidenceGauge percentage={style.confidenceVal} color={style.color} />
                          </div>
                        );
                      })()
                    ) : (
                      <span className="font-mono text-xs text-textDim flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-steelBlue" />
                        AWAITING_VERDICT_STAMP...
                      </span>
                    )}
                  </div>

                  {/* Header company labels */}
                  <div className="md:text-right">
                    <span className="font-mono text-[9px] text-paleBlue uppercase tracking-wider block mb-1">TARGET_DOSSIER</span>
                    <span className="text-3xl font-mono font-bold tracking-tight text-paper uppercase">
                      {activeResult?.companyName || companyName || 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                {/* Case summary paragraph (Established editorial type scale, 16px body, let it breathe) */}
                <div className="text-base leading-relaxed text-textMuted max-w-2xl font-sans mt-8 border-l border-line/40 pl-6">
                  {activeResult?.analysis?.summary ? (
                    <p>{activeResult.analysis.summary}</p>
                  ) : activeResult?.reasoning ? (
                    <p>{activeResult.reasoning}</p>
                  ) : (
                    <p className="italic text-textDim font-mono">[COMPILING_CASE_DOSSIER_SUMMARY_IN_PROGRESS...]</p>
                  )}
                </div>
              </div>

              {/* SECTION 2: FINANCIALS */}
              <div 
                ref={financialsRef}
                id="financials"
                className="scroll-mt-12 pt-4"
              >
                <div className="border-b border-line pb-2 mb-8">
                  <span className="font-mono text-[10px] text-textDim uppercase tracking-[0.18em]">
                    financial diagnostics // indicators
                  </span>
                </div>

                {/* Plain label/value list with editorial type scale (15-18px values, 11px uppercase label above) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 max-w-2xl">
                  {[
                    { label: 'MARKET CAPITALIZATION', key: 'marketCap' },
                    { label: 'STOCK PRICE QUOTE', key: 'stockPrice' },
                    { label: 'PE RATIO MULTIPLIER', key: 'peRatio' },
                    { label: 'DEBT TO EQUITY RATIO', key: 'debtToEquity' },
                    { label: 'PROFIT MARGIN RATIO', key: 'profitMargin' },
                    { label: 'DIVIDEND YIELD PERCENT', key: 'dividendYield' }
                  ].map((item) => {
                    const rawVal = activeResult?.financials[item.key as keyof typeof activeResult.financials];
                    const val = typeof rawVal === 'string' && isValValid(rawVal) ? rawVal : null;
                    return (
                      <div key={item.key} className="border-b border-line/20 pb-3 flex flex-col gap-1.5">
                        <span className="font-mono text-[9px] text-paleBlue uppercase tracking-wider">{item.label}</span>
                        <span className="font-mono text-base text-paper font-semibold">
                          {val || (activeResult ? 'N/A' : 'RESOLVING...')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: EXHIBITS */}
              <div 
                ref={exhibitsRef}
                id="exhibits"
                className="scroll-mt-12 pt-4"
              >
                <div className="border-b border-line pb-2 mb-8">
                  <span className="font-mono text-[10px] text-textDim uppercase tracking-[0.18em]">
                    case exhibits // qualitative indicators
                  </span>
                </div>

                <div className="space-y-8 max-w-2xl">
                  {activeResult?.financials.notPubliclyListed ? (
                    <div className="p-4 border border-line bg-ledgerSurface/40 font-mono text-xs text-textDim leading-relaxed">
                      [EXHIBIT_A_TO_D_DEACTIVATED]: Qualitative SWOT exhibits are compiled from public regulatory filings and market indices. Since this entity is private, standard audited public disclosures are not listed.
                    </div>
                  ) : (
                    <>
                      {/* EXHIBIT A: STRENGTHS */}
                      <div className="border-l border-steelBlue/20 pl-4 py-1">
                        <span className="font-mono text-[10px] text-paleBlue uppercase tracking-[0.12em] block mb-2.5">exhibit a — strengths</span>
                        <ul className="space-y-2">
                          {activeResult?.analysis?.strengths.map((bullet, idx) => (
                            <li key={idx} className="text-sm text-textMuted leading-relaxed flex items-start gap-2.5">
                              <span className="text-steelBlue font-mono select-none">—</span>
                              <span>{bullet}</span>
                            </li>
                          )) || <li className="text-xs text-textDim font-mono list-none">[AWAITING...]</li>}
                        </ul>
                      </div>

                      {/* EXHIBIT B: WEAKNESSES */}
                      <div className="border-l border-mutedRose/20 pl-4 py-1">
                        <span className="font-mono text-[10px] text-mutedRose uppercase tracking-[0.12em] block mb-2.5">exhibit b — weaknesses</span>
                        <ul className="space-y-2">
                          {activeResult?.analysis?.weaknesses.map((bullet, idx) => (
                            <li key={idx} className="text-sm text-textMuted leading-relaxed flex items-start gap-2.5">
                              <span className="text-mutedRose font-mono select-none">—</span>
                              <span>{bullet}</span>
                            </li>
                          )) || <li className="text-xs text-textDim font-mono list-none">[AWAITING...]</li>}
                        </ul>
                      </div>

                      {/* EXHIBIT C: OPPORTUNITIES */}
                      <div className="border-l border-steelBlue/20 pl-4 py-1">
                        <span className="font-mono text-[10px] text-paleBlue uppercase tracking-[0.12em] block mb-2.5">exhibit c — opportunities</span>
                        <ul className="space-y-2">
                          {activeResult?.analysis?.opportunities.map((bullet, idx) => (
                            <li key={idx} className="text-sm text-textMuted leading-relaxed flex items-start gap-2.5">
                              <span className="text-steelBlue font-mono select-none">—</span>
                              <span>{bullet}</span>
                            </li>
                          )) || <li className="text-xs text-textDim font-mono list-none">[AWAITING...]</li>}
                        </ul>
                      </div>

                      {/* EXHIBIT D: THREATS */}
                      <div className="border-l border-mutedRose/20 pl-4 py-1">
                        <span className="font-mono text-[10px] text-mutedRose uppercase tracking-[0.12em] block mb-2.5">exhibit d — threats</span>
                        <ul className="space-y-2">
                          {activeResult?.analysis?.threats.map((bullet, idx) => (
                            <li key={idx} className="text-sm text-textMuted leading-relaxed flex items-start gap-2.5">
                              <span className="text-mutedRose font-mono select-none">—</span>
                              <span>{bullet}</span>
                            </li>
                          )) || <li className="text-xs text-textDim font-mono list-none">[AWAITING...]</li>}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION 4: REASONING TRACE */}
              <div 
                ref={reasoningRef}
                id="reasoning"
                className="scroll-mt-12 pt-4"
              >
                <div className="border-b border-line pb-2 mb-8">
                  <span className="font-mono text-[10px] text-textDim uppercase tracking-[0.18em]">
                    execution trace logs // ledger
                  </span>
                </div>

                {/* Typed report format */}
                <div className="divide-y divide-line/40 space-y-5 max-w-2xl">
                  <AnimatePresence initial={false}>
                    {terminalTrace.map((step, idx) => (
                      <motion.div
                        key={`${step.node}-${idx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.05 }}
                        className="pt-4 first:pt-0"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="font-mono text-[9px] text-paleBlue uppercase font-semibold">
                            [{step.timestamp || '00:00:00'}] {step.node.toUpperCase()}
                          </span>
                          <span className={`font-mono text-[8px] uppercase px-1.5 py-0.5 rounded border ${
                            step.status === 'failed' 
                              ? 'border-mutedRose text-mutedRose' 
                              : 'border-line text-textDim'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        <p className="font-sans text-xs text-textMuted leading-relaxed">
                          {step.message}
                        </p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {terminalTrace.length === 0 && (
                    <div className="font-mono text-xs text-textDim">
                      [INITIATING_WORKSPACE_COMPILATION]
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 5: SOURCES */}
              <div 
                ref={sourcesRef}
                id="sources"
                className="scroll-mt-12 pt-4"
              >
                <div className="border-b border-line pb-2 mb-8">
                  <span className="font-mono text-[10px] text-textDim uppercase tracking-[0.18em]">
                    citations // audited sources
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 max-w-xl">
                  {activeResult?.news && activeResult.news.length > 0 ? (
                    activeResult.news.map((citation, index) => (
                      <a
                        key={index}
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1 px-2 -mx-2 hover:bg-ledgerSurface/40 flex items-center justify-between text-xs text-textDim hover:text-paleBlue transition-all duration-150 group border border-transparent hover:border-line/30 rounded"
                      >
                        <span className="font-mono text-[9px] text-paleBlue shrink-0">
                          [{citation.source?.toUpperCase() || 'WEB'}]
                        </span>
                        <span className="truncate max-w-[80%] text-textMuted group-hover:underline group-hover:text-paper font-sans">
                          {citation.title}
                        </span>
                        <ExternalLink className="w-3 h-3 text-textDim shrink-0 group-hover:text-paleBlue" />
                      </a>
                    ))
                  ) : (
                    <span className="font-mono text-xs text-textDim">[AWAITING_CITATIONS_RESOLVING]</span>
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* Empty Portal Case Landing Panel */
            <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-line rounded bg-ledgerSurface/10 max-w-xl mx-auto">
              <FolderOpen className="w-10 h-10 text-steelBlue mb-4" />
              <h2 className="font-mono font-bold text-[10px] text-paper uppercase tracking-widest mb-2">
                AURA // STATE_COMPILER
              </h2>
              <p className="text-xs text-textMuted max-w-xs leading-relaxed font-sans px-4">
                No active case dossier. Query a stock target in the input terminal above to compile quantitative research report documents.
              </p>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
