import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Droplets,
  Zap,
  HeartPulse,
  Trash2,
  Recycle,
  Leaf,
  Box,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  Globe,
  Loader2,
  Camera,
  BookOpen,
} from 'lucide-react';
import { ActiveTab } from './Navbar';
import { WASTE_ITEMS } from '../data/wasteItems';
import { WasteItem, InspectionResult } from '../types';
import { useEncyclopediaStore, saveValidatedSearchToEncyclopedia } from '../utils/encyclopediaStore';

interface HomePageProps {
  onNavigate: (tab: ActiveTab, subTab?: 'ai_inspector' | 'catalog' | 'resin_codes') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Waste Hierarchy & Golden Rules tab switcher state
  const [activeRulesTab, setActiveRulesTab] = useState<'golden_rules' | 'hierarchy'>('golden_rules');

  // Mobile Keyboard & Focus Optimization State
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const gamesRef = React.useRef<HTMLDivElement>(null);

  const scrollToGames = () => {
    gamesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // AI-Powered Search & Google Verification State
  const { allItems, saveValidatedSearch } = useEncyclopediaStore();
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState<InspectionResult | null>(null);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  const handleSearchFocus = () => {
    setIsInputFocused(true);
    // Smoothly scroll the search box into the top portion of the screen right below the header
    // so the mobile virtual keyboard is placed cleanly BELOW the search box and the user
    // can clearly see what they are typing without keyboard obstruction.
    const scrollTarget = () => {
      if (searchContainerRef.current) {
        const rect = searchContainerRef.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 16;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }
    };
    setTimeout(scrollTarget, 80);
    setTimeout(scrollTarget, 240);
  };

  const handleSearchBlur = () => {
    setTimeout(() => {
      setIsInputFocused(false);
    }, 250);
  };

  const handleAiSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!q) return;

    if (queryText !== undefined) {
      setSearchQuery(queryText);
    }

    setIsAiSearching(true);
    setAiSearchError(null);

    try {
      const res = await fetch('/api/inspect-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: q }),
      });

      if (!res.ok) throw new Error('AI search failed');
      const data: InspectionResult = await res.json();
      setAiSearchResult(data);
    } catch {
      setAiSearchError('Could not verify item with AI. Showing local catalog results below.');
    } finally {
      setIsAiSearching(false);
    }
  };

  // Filtered waste catalog search
  const filteredItems = useMemo(() => {
    let list = allItems;
    if (selectedCategory !== 'all') {
      list = list.filter(item => {
        if (selectedCategory === 'plastics') return item.category === 'plastics';
        if (selectedCategory === 'paper_cardboard') return item.category === 'paper_cardboard';
        if (selectedCategory === 'metals') return item.category === 'metals';
        if (selectedCategory === 'glass') return item.category === 'glass';
        if (selectedCategory === 'organics') return item.category === 'organics';
        if (selectedCategory === 'textiles') return item.category === 'textiles' || item.bin === 'cloth_recycling';
        if (selectedCategory === 'e_waste') return item.category === 'e_waste_hazardous' || item.bin === 'e_waste';
        if (selectedCategory === 'medical_waste') return item.bin === 'medical_waste';
        if (selectedCategory === 'meat_bones') return item.bin === 'meat_bones' || item.category === 'meat_bones';
        if (selectedCategory === 'hard_rubbish') return item.bin === 'hard_rubbish' || item.category === 'hard_rubbish';
        return true;
      });
    }

    if (!searchQuery.trim()) {
      return list.slice(0, 12);
    }

    const q = searchQuery.toLowerCase().trim();
    return list.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.whyItGoesHere.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q)) ||
      item.prepInstructions.some(p => p.toLowerCase().includes(q))
    ).slice(0, 24);
  }, [searchQuery, selectedCategory]);

  const getBinBadgeColor = (bin: string) => {
    switch (bin) {
      case 'commingled_recycling':
      case 'recycling':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'organic':
      case 'compost':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'paper_cardboard':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'cloth_recycling':
        return 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
      case 'soft_plastic_dropoff':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold';
      case 'e_waste':
        return 'bg-stone-900 text-amber-300 border-stone-800 font-bold';
      case 'medical_waste':
        return 'bg-rose-50 text-rose-900 border-rose-300';
      case 'meat_bones':
        return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'hard_rubbish':
        return 'bg-amber-800 text-amber-100 border-amber-900 font-bold';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  const getBinNameFormatted = (bin: string) => {
    switch (bin) {
      case 'commingled_recycling':
      case 'recycling':
        return '🟡 Yellow: Commingled';
      case 'organic':
      case 'compost':
        return '🟢 Green: FOGO / Organic';
      case 'paper_cardboard':
        return '🔵 Blue: Cardboard & Paper';
      case 'cloth_recycling':
        return '👕 Cloth: Designated Drop-Off (Station, Coles)';
      case 'soft_plastic_dropoff':
        return '🛍️ Soft Plastic: Supermarket Drop-Off';
      case 'e_waste':
        return '🏬 E-Waste: Designated Drop-Off';
      case 'medical_waste':
        return '⚪ White: Medical / Sharps';
      case 'meat_bones':
        return '🟠 Orange: Meat & Bones';
      case 'hard_rubbish':
        return '🛋️ Hard Rubbish: Council Collection';
      default:
        return '🔴 Red: General Waste';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Welcome Banner with Quick Search */}
      <section className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-emerald-950 via-stone-950 to-stone-900 text-white p-6 sm:p-10 shadow-2xl shadow-emerald-950/40 border border-white/10">
        {/* Animated glow blobs + dot grid texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 text-xs sm:text-sm font-extrabold text-emerald-200 shadow-2xs animate-fade-in-up">
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>Complete Modern Waste Separation & Circular Economy Guide</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight animate-fade-in-up">
            Know Where It Goes. <br className="hidden sm:inline" />
            <span className="text-gradient-eco">Sort Clean, Waste Zero.</span>
          </h1>

          {/* Quick value-prop stat strip */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 animate-fade-in-up">
            {[
              { label: '9 Waste Streams', icon: '♻️', onClick: undefined },
              { label: '3 Interactive Games', icon: '🎮', onClick: scrollToGames },
              { label: 'AI-Powered Verification', icon: '✨', onClick: undefined },
            ].map(stat => {
              const className = "inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold text-emerald-50 transition-colors";
              return stat.onClick ? (
                <button key={stat.label} type="button" onClick={stat.onClick} className={`${className} cursor-pointer`}>
                  <span>{stat.icon}</span>
                  {stat.label}
                </button>
              ) : (
                <span key={stat.label} className={className}>
                  <span>{stat.icon}</span>
                  {stat.label}
                </span>
              );
            })}
          </div>

          <p className="text-stone-200/90 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
            Every year, millions of tons of clean recyclables are ruined by wishcycling and improper binning. Explore our complete guide to all 9 municipal waste streams & drop-off networks, learn critical preparation steps, and test your skills in interactive challenges!
          </p>

          {/* Quick-Jump Waste Search Bar with AI & Google Grounding */}
          <div ref={searchContainerRef} className="pt-2 scroll-mt-20 sm:scroll-mt-28">
            <div className="relative max-w-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAiSearch(searchQuery);
                }}
                className={`relative flex items-center transition-all duration-200 rounded-2xl ${
                  isInputFocused ? 'ring-4 ring-emerald-400/50 shadow-xl' : 'shadow-lg'
                }`}
              >
                <Search className="w-5 h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  id="home-search-input"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setAiSearchResult(null);
                    }
                  }}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Search any rubbish (e.g. bubble wrap, air pillow, clothes)..."
                  className="w-full pl-10 sm:pl-12 pr-28 sm:pr-44 py-3.5 rounded-2xl bg-white text-stone-900 placeholder:text-stone-400 text-base sm:text-sm font-semibold focus:outline-none border border-stone-200 transition-colors"
                />
                <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blurring input
                        setSearchQuery('');
                        setAiSearchResult(null);
                        searchInputRef.current?.focus();
                      }}
                      className="w-7 h-7 flex items-center justify-center text-xs font-bold text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    id="home-ai-search-btn"
                    type="submit"
                    disabled={isAiSearching || !searchQuery.trim()}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold text-xs px-2.5 sm:px-3.5 py-2 rounded-xl shadow-md shadow-emerald-900/20 transition-all cursor-pointer whitespace-nowrap"
                    title="Verify disposal stream using Gemini AI & Google Search data"
                  >
                    {isAiSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="hidden sm:inline">Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span className="hidden sm:inline">AI & Google </span>
                        <span>Verify</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Mobile Live Typing Bar - placed directly below search box so user clearly sees what they type above soft keyboard */}
              {isInputFocused && (
                <div className="sm:hidden mt-2 p-2.5 rounded-xl bg-stone-950/95 backdrop-blur-md border border-amber-600/50 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <span className="text-amber-400 font-black shrink-0">Typing:</span>
                      {searchQuery.trim() ? (
                        <span className="font-extrabold truncate text-white max-w-[200px] bg-white/10 px-1.5 py-0.5 rounded">
                          &ldquo;{searchQuery}&rdquo;
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">Start typing or tap below...</span>
                      )}
                    </div>
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAiSearch(searchQuery);
                        }}
                        className="text-[11px] font-black text-stone-950 bg-amber-400 hover:bg-amber-300 px-2.5 py-1 rounded-lg shrink-0 active:scale-95 cursor-pointer shadow-xs"
                      >
                        Verify ↵
                      </button>
                    )}
                  </div>
                  {/* Quick-tap suggestions for fast mobile typing */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
                    <span className="text-stone-400 text-[10px] uppercase font-bold shrink-0">Quick:</span>
                    {[
                      'Bubble Wrap',
                      'Air Pillows',
                      'Unsure Item',
                      'Old Clothes',
                      'Shoes',
                      'Pizza Box',
                      'Battery',
                    ].map(kw => (
                      <button
                        key={kw}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchQuery(kw);
                          handleAiSearch(kw);
                        }}
                        className="bg-stone-800 hover:bg-amber-900/80 text-stone-200 hover:text-amber-200 px-2 py-0.5 rounded-md border border-stone-700 whitespace-nowrap shrink-0 active:scale-95"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-stone-300/90 mt-2.5 font-medium">
              <span>Popular searches:</span>
              {[
                'Bubble Wrap',
                'Packaging Air Pillows',
                'Unsure Item',
                'Old Clothes & Shoes',
                'Clean Pizza Box',
                'Styrofoam Meat Tray',
                'Greasy Pizza Box',
                'Mussel Shells',
                'Alkaline Battery',
              ].map(kw => (
                <button
                  key={kw}
                  onClick={() => handleAiSearch(kw)}
                  className="underline hover:text-white transition-colors cursor-pointer bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subtle Background Decorative Graphic */}
        <div className="absolute right-0 bottom-0 top-0 opacity-10 pointer-events-none hidden md:flex items-center justify-center pr-12 text-[260px] select-none animate-float">
          🌍
        </div>
      </section>

      {/* Live Search Quick Results (Only visible when user types or filters) */}
      {searchQuery.trim() && (
        <section className="glass-strong rounded-3xl p-6 sm:p-8 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-base font-bold">🔍</span>
              <h2 className="text-xl font-extrabold text-stone-900">
                Search Results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full">
                {filteredItems.length} found
              </span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setAiSearchResult(null);
              }}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
            >
              Close Search
            </button>
          </div>

          {/* AI Verification Loading State */}
          {isAiSearching && (
            <div className="bg-emerald-50 border border-emerald-300/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-2xs">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
              <div>
                <h4 className="text-sm font-extrabold text-emerald-950">
                  Verifying &ldquo;{searchQuery}&rdquo; with WasteSort AI & Google Search Data...
                </h4>
                <p className="text-xs text-emerald-700 font-medium">
                  Checking municipal solid waste standards, commercial FOGO composting, bio-rendering, and dual-stream acceptance rules.
                </p>
              </div>
            </div>
          )}

          {/* AI & Google Verified Result Card */}
          {aiSearchResult && !isAiSearching && (
            <div className="bg-gradient-to-br from-emerald-50/80 via-white to-stone-50 border border-emerald-300/60 rounded-3xl p-5 sm:p-7 shadow-lg shadow-emerald-900/5 space-y-5 animate-scale-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      WasteSort AI Verified Analysis
                    </span>
                    <span className="text-xs font-bold text-stone-600 bg-white border border-stone-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Globe className="w-3 h-3 text-blue-600" />
                      Google Verified Data
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 tracking-tight">
                    {aiSearchResult.itemName}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-3 py-1.5 rounded-xl border ${getBinBadgeColor(aiSearchResult.primaryBin)}`}>
                    {getBinNameFormatted(aiSearchResult.primaryBin)}
                  </span>
                  <button
                    onClick={() => onNavigate('ai_inspector')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    title="Open Camera in AI Inspector"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Camera Inspector</span>
                  </button>
                </div>
              </div>

              {/* Special Notice for E-Waste */}
              {aiSearchResult.primaryBin === 'e_waste' && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-stone-900 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 font-black text-amber-950 text-xs sm:text-sm">
                    <span className="p-1 bg-amber-500 text-stone-950 rounded-md text-xs font-extrabold">⚠️ CRITICAL</span>
                    <span>E-Waste Mandatory Drop-Off (Do Not Put in Curbside Bins)</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold leading-relaxed text-amber-950">
                    Instead, you must take e-waste to a designated drop-off location, such as your local council&apos;s resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.
                  </p>
                </div>
              )}

              {/* DUAL / MULTI-STREAM ACCEPTANCE SHOWCASE (e.g. Raw Meat in both Meat & Bones and Organic) */}
              {aiSearchResult.acceptableBins && aiSearchResult.acceptableBins.length > 1 ? (
                <div className="bg-white border-2 border-emerald-400/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="p-2 bg-emerald-600 text-white rounded-xl text-base shrink-0 shadow-xs">
                      ✨
                    </span>
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-stone-900">
                        Accepted in Multiple Waste Streams (Both Answers Correct!)
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed font-medium">
                        Depending on your regional council&apos;s processing technology, this item is accepted in <strong className="text-stone-900">both</strong> bins shown below:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {aiSearchResult.acceptableBins.map((opt, idx) => (
                      <div
                        key={idx}
                        className="bg-stone-50/80 border border-emerald-300/70 rounded-2xl p-4 space-y-2 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${getBinBadgeColor(opt.bin)}`}>
                            {opt.binName}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                            Valid Option #{idx + 1}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-stone-800">
                          {opt.condition}
                        </div>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          {opt.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-2xl border border-stone-200 text-xs text-stone-700 leading-relaxed font-medium">
                  <strong className="text-stone-900 block mb-1">Sorting Logic:</strong>
                  {aiSearchResult.whyItGoesHere}
                </div>
              )}

              {/* Step-by-Step Preparation */}
              {aiSearchResult.prepInstructions && aiSearchResult.prepInstructions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Preparation & Hygiene Protocol</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {aiSearchResult.prepInstructions.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white p-3 rounded-xl border border-stone-200 text-xs text-stone-800 shadow-2xs">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed font-medium">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wishcycling warning & Verification footnote */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {aiSearchResult.wishcyclingWarning && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-900 font-bold">Wishcycling Contamination Alert:</strong>
                      <span>{aiSearchResult.wishcyclingWarning}</span>
                    </div>
                  </div>
                )}

                {aiSearchResult.verificationNote && (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 flex items-start gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-blue-900 font-bold">Verification Note (Google & Council Standards):</strong>
                      <span>{aiSearchResult.verificationNote}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Added to Disposal Encyclopedia Notification */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-2xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shrink-0">✨</span>
                  <div>
                    <span className="text-xs font-black text-emerald-950 block">
                      Disposal Encyclopedia Updated!
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Validated with Google Search & AI municipal rules and saved to your permanent catalog.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('ai_inspector', 'catalog')}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
                >
                  <span>Open Encyclopedia</span>
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {aiSearchError && (
            <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-medium">
              {aiSearchError}
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
              Matching Encyclopedia Items ({filteredItems.length}):
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 hover:bg-white hover:border-emerald-400 transition-all shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl p-2 bg-white rounded-xl border border-stone-200 shadow-2xs">{item.emoji}</span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-sm text-stone-900 leading-tight">{item.name}</h4>
                      </div>
                      <span className="text-[11px] text-stone-500 capitalize">{item.category.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border whitespace-nowrap ${getBinBadgeColor(item.bin)}`}>
                    {getBinNameFormatted(item.bin)}
                  </span>
                </div>

                <div className="text-xs text-stone-700 leading-relaxed font-medium">
                  {item.whyItGoesHere}
                </div>

                {item.prepInstructions.length > 0 && (
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 space-y-1">
                    <span className="font-bold text-stone-800 block">How to prepare:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                      {item.prepInstructions.slice(0, 2).map((step, i) => (
                        <li key={i} className="leading-tight">{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.wishcyclingWarning && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200/70 flex items-start gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{item.wishcyclingWarning}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

        {/* The 4 Golden Rules & The Waste Hierarchy (Compact Tab Switcher) */}
        <section className="bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-0.5 rounded-full text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mastery Best Practices</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight">
                The 4 Golden Rules & Waste Hierarchy
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 font-normal">
                Prioritize avoidance and clean sorting before binning to safeguard recycling streams.
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center bg-stone-800/90 p-1 rounded-2xl border border-stone-700/80 shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setActiveRulesTab('golden_rules')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeRulesTab === 'golden_rules'
                    ? 'bg-emerald-500 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <span>🧼 4 Golden Rules</span>
              </button>
              <button
                onClick={() => setActiveRulesTab('hierarchy')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeRulesTab === 'hierarchy'
                    ? 'bg-emerald-500 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <span>🔺 Waste Hierarchy</span>
              </button>
            </div>
          </div>

          {/* Tab Content: 4 Golden Rules */}
          {activeRulesTab === 'golden_rules' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">🧼</span>
                <h4 className="font-extrabold text-sm text-white">1. Empty & Quick Rinse</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Food residues breed mold and spoil dry cardboard fibers. Swish a dash of leftover wash-up water to ensure containers are empty and clean.
                </p>
              </div>

              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">🧴</span>
                <h4 className="font-extrabold text-sm text-white">2. Caps Screwed ON</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Loose caps fall through industrial conveyor trommels into landfill. Always leave screw caps firmly attached to clean plastic bottles.
                </p>
              </div>

              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">📦</span>
                <h4 className="font-extrabold text-sm text-white">3. Keep Items 100% Loose</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Never bag blue or yellow bin items in plastic bags! Automated sorting machinery cannot rip open plastic bags; workers must divert tied bags straight to landfill.
                </p>
              </div>

              <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700/70 space-y-2">
                <span className="text-3xl block">🚫</span>
                <h4 className="font-extrabold text-sm text-white">4. No Wishcycling</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-normal">
                  Putting non-recyclables into recycling in the &ldquo;hope&rdquo; they will be recycled contaminates entire truckloads. When in doubt, look it up or bin it out.
                </p>
              </div>
            </div>
          ) : (
            /* Tab Content: 5 Tiers of Waste Hierarchy */
            <div className="space-y-2.5 animate-in fade-in duration-200">
              <div className="bg-emerald-900/60 border border-emerald-500/60 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-emerald-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center font-black text-xs">1</span>
                  <span>Refuse & Avoid</span>
                </span>
                <span className="text-xs text-emerald-300 font-medium hidden sm:inline">Say no to single-use plastics, excessive packaging, and disposable cutlery.</span>
              </div>

              <div className="bg-emerald-950/60 border border-emerald-600/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-emerald-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs">2</span>
                  <span>Reduce & Reuse</span>
                </span>
                <span className="text-xs text-emerald-300/80 font-medium hidden sm:inline">Choose refillable containers, repair electronics, and repurpose glass jars.</span>
              </div>

              <div className="bg-teal-950/60 border border-teal-600/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-teal-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-xs">3</span>
                  <span>Recycle & Compost</span>
                </span>
                <span className="text-xs text-teal-300/80 font-medium hidden sm:inline">Properly separate organic waste, clean paper, bottles, and metals into designated bins.</span>
              </div>

              <div className="bg-amber-950/50 border border-amber-600/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-amber-200">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-stone-950 flex items-center justify-center font-black text-xs">4</span>
                  <span>Energy Recovery</span>
                </span>
                <span className="text-xs text-amber-300/80 font-medium hidden sm:inline">Thermal Waste-to-Energy (WtE) electricity generation from residual unrecyclable mass.</span>
              </div>

              <div className="bg-stone-800/60 border border-stone-700/60 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-stone-300">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-stone-700 text-white flex items-center justify-center font-black text-xs">5</span>
                  <span>Landfill Disposal (Last Resort)</span>
                </span>
                <span className="text-xs text-stone-400 font-medium hidden sm:inline">Engineered sanitary containment of unavoidable non-recoverable residues.</span>
              </div>
            </div>
          )}
        </section>

      {/* Interactive FAQ & Household Setup Accordion */}
      <section className="glass-strong rounded-3xl p-6 sm:p-10 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg text-lg">❓</span>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Frequently Asked Waste Management Questions
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Real solutions to everyday waste sorting dilemmas faced by households.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 'faq-1',
              q: 'Should I crush my plastic drink bottles before putting them in the recycling bin?',
              a: 'Do NOT crush plastic bottles completely flat. Optical sorting machines at Materials Recovery Facilities (MRFs) rely on infrared light reflecting off the three-dimensional curve of the bottle to detect the plastic resin type (PET #1 or HDPE #2). Completely flat bottles are often misidentified as 2D paper sheets and routed to paper pulpers where they spoil fiber batches. Giving them a light squeeze is fine, but leave some 3D shape!'
            },
            {
              id: 'faq-2',
              q: 'Can I put broken drinking glasses or ceramics in the yellow recycling bin?',
              a: 'No! Drinking glasses, window glass, mirrors, Pyrex cookware, and ceramic coffee mugs have different chemical formulations and significantly higher melting temperatures than container glass (wine bottles and jam jars). If even a tiny shard of ceramic or drinking glass enters the furnace batch, it will not melt properly, creating structural defects and cracks in newly blown bottles.'
            },
            {
              id: 'faq-3',
              q: 'What should I do with shiny metallic chip packets and foil snack wrappers?',
              a: 'Most chip bags are made of multi-laminate composite materials (a thin layer of aluminum bonded to polypropylene plastic film). Because the layers cannot be easily separated mechanically, they cannot go into your yellow commingled recycling bin. Place them in your Red General Waste bin, or take them to participating supermarket soft-plastic collection drop-offs.'
            },
            {
              id: 'faq-4',
              q: 'Where do pizza boxes and styrofoam meat trays go?',
              a: 'A clean and unused pizza box (or clean torn-off lid) goes directly into the Blue Lid Bin (Cardboard & Paper) because it is 100% clean kraft corrugated cardboard. However, once a pizza box is greasy or cheese-stained, food grease cannot be washed out and spoils compost—so greasy pizza boxes strictly belong in the Red General Waste bin (never in the green FOGO bin!). Meanwhile, styrofoam meat trays ONLY go to General Waste (Red Lid Bin); expanded polystyrene crumbles into microplastics and is forbidden from yellow recycling, orange meat, and green organic bins.'
            },
            {
              id: 'faq-5',
              q: 'How should I set up my kitchen bins for effortless separation?',
              a: 'The most effective household setup is having a dual-compartment under-sink or pantry bin: one for Commingled Recycling and one for General Waste. Keep a small kitchen caddy right next to your sink for FOGO food scraps (empty daily or every two days). Keep a designated glass jar in a utility closet for taped dead batteries, and keep a reusable tote bag for soft plastics to bring to the grocery store.'
            }
          ].map((faq) => {
            const isOpen = expandedFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className="border border-stone-200/70 rounded-2xl overflow-hidden transition-all bg-white/50"
              >
                <button
                  onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                  className="w-full p-4 sm:p-5 text-left hover:bg-white/60 flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-stone-900 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-700">Q:</span>
                    <span>{faq.q}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-5 pb-5 pt-2 bg-white/40 text-xs sm:text-sm text-stone-700 leading-relaxed font-normal border-t border-stone-100"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 Interactive Games Hub */}
      <section ref={gamesRef} className="space-y-6 scroll-mt-24 sm:scroll-mt-28">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-lg">🎮</span>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              3 Interactive Games
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Choose an interactive mode to earn XP, unlock Eco-badges, and become a certified Waste Management Master!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bin Master Card */}
          <div className="glass glass-hover rounded-3xl p-6 hover:border-emerald-400/60 flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <span className="text-4xl p-3 bg-emerald-50 rounded-2xl inline-block border border-emerald-200/80">🎯</span>
              <h3 className="font-black text-lg text-stone-900 group-hover:text-emerald-700 transition-colors">
                Bin Master Game
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-normal">
                Rapidly sort random household items into the correct 6-lid bins. Build combos, earn streak multipliers, and conquer tricky traps!
              </p>
            </div>
            <button
              onClick={() => onNavigate('bin_master')}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Play Game</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Contamination Detective Card */}
          <div className="glass glass-hover rounded-3xl p-6 hover:border-amber-400/60 flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <span className="text-4xl p-3 bg-amber-50 rounded-2xl inline-block border border-amber-200/80">🕵️</span>
              <h3 className="font-black text-lg text-stone-900 group-hover:text-amber-700 transition-colors">
                Contamination Detective
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-normal">
                Spot the batch-spoiling contaminants hiding in each waste stream before they jam machinery or ruin a whole load.
              </p>
            </div>
            <button
              onClick={() => onNavigate('contamination_detective')}
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Play Game</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Trivia Card */}
          <div className="glass glass-hover rounded-3xl p-6 hover:border-indigo-400/60 flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <span className="text-4xl p-3 bg-indigo-50 rounded-2xl inline-block border border-indigo-200/80">🧠</span>
              <h3 className="font-black text-lg text-stone-900 group-hover:text-indigo-700 transition-colors">
                Recycle IQ Trivia
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-normal">
                Test your knowledge against common recycling myths and mistakes, with a real explanation behind every answer.
              </p>
            </div>
            <button
              onClick={() => onNavigate('trivia')}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Play Game</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
