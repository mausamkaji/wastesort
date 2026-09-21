import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  Flame, 
  Infinity as InfinityIcon,
  HelpCircle
} from 'lucide-react';
import { CONTAMINATION_SCENARIOS } from '../data/scenarios';
import { ContaminationScenario, BinType } from '../types';
import { useGame } from '../context/GameContext';
import { sound } from '../utils/audio';

interface StreamStyleConfig {
  name: string;
  sub: string;
  lidLabel: string;
  lidColor: string;
  lidBorder: string;
  accentText: string;
  bgBrief: string;
  borderBrief: string;
  badgeBg: string;
  badgeText: string;
  icon: string;
}

const STREAM_STYLES: Record<string, StreamStyleConfig> = {
  e_waste: {
    name: 'E-Waste',
    sub: 'Designated Drop-Off Depot',
    lidLabel: '🏬 Designated Drop-Off: E-Waste',
    lidColor: 'bg-stone-900',
    lidBorder: 'border-stone-800',
    accentText: 'text-stone-900',
    bgBrief: 'bg-stone-100/90',
    borderBrief: 'border-stone-400',
    badgeBg: 'bg-stone-900',
    badgeText: 'text-amber-300 border-stone-800 font-bold',
    icon: '🔌',
  },
  hard_rubbish: {
    name: 'Hard Rubbish',
    sub: 'Council Collection / Transfer Station',
    lidLabel: '🛋️ Hard Rubbish: Council Collection',
    lidColor: 'bg-amber-800',
    lidBorder: 'border-amber-900',
    accentText: 'text-amber-950',
    bgBrief: 'bg-amber-50/80',
    borderBrief: 'border-amber-300',
    badgeBg: 'bg-amber-800',
    badgeText: 'text-amber-100 border-amber-900 font-bold',
    icon: '🛋️',
  },
  medical_waste: {
    name: 'Medical Waste',
    sub: 'White Lid Bin',
    lidLabel: '⚪ White Lid: Medical Waste',
    lidColor: 'bg-white',
    lidBorder: 'border-rose-400',
    accentText: 'text-rose-950',
    bgBrief: 'bg-stone-50/90',
    borderBrief: 'border-rose-300',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-900 border-rose-300',
    icon: '🩺',
  },
  commingled_recycling: {
    name: 'Commingled Recycling',
    sub: 'Yellow Lid Bin',
    lidLabel: '🟡 Yellow Lid: Commingled Recycling',
    lidColor: 'bg-amber-500',
    lidBorder: 'border-amber-600',
    accentText: 'text-amber-950',
    bgBrief: 'bg-amber-50/80',
    borderBrief: 'border-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900 border-amber-300',
    icon: '♻️',
  },
  recycling: {
    name: 'Commingled Recycling',
    sub: 'Yellow Lid Bin',
    lidLabel: '🟡 Yellow Lid: Commingled Recycling',
    lidColor: 'bg-amber-500',
    lidBorder: 'border-amber-600',
    accentText: 'text-amber-950',
    bgBrief: 'bg-amber-50/80',
    borderBrief: 'border-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900 border-amber-300',
    icon: '♻️',
  },
  organic: {
    name: 'Organics (FOGO)',
    sub: 'Green Lid Bin',
    lidLabel: '🟢 Green Lid: Organic',
    lidColor: 'bg-emerald-600',
    lidBorder: 'border-emerald-700',
    accentText: 'text-emerald-950',
    bgBrief: 'bg-emerald-50/80',
    borderBrief: 'border-emerald-300',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900 border-emerald-300',
    icon: '🌿',
  },
  compost: {
    name: 'Organics (FOGO)',
    sub: 'Green Lid Bin',
    lidLabel: '🟢 Green Lid: Organic',
    lidColor: 'bg-emerald-600',
    lidBorder: 'border-emerald-700',
    accentText: 'text-emerald-950',
    bgBrief: 'bg-emerald-50/80',
    borderBrief: 'border-emerald-300',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900 border-emerald-300',
    icon: '🌿',
  },
  paper_cardboard: {
    name: 'Cardboard & Paper',
    sub: 'Blue Lid Bin',
    lidLabel: '🔵 Blue Lid: Cardboard & Paper',
    lidColor: 'bg-blue-600',
    lidBorder: 'border-blue-700',
    accentText: 'text-blue-950',
    bgBrief: 'bg-blue-50/80',
    borderBrief: 'border-blue-300',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900 border-blue-300',
    icon: '📦',
  },
  general_waste: {
    name: 'General Waste',
    sub: 'Red Lid Bin',
    lidLabel: '🔴 Red Lid: General Waste',
    lidColor: 'bg-rose-600',
    lidBorder: 'border-rose-700',
    accentText: 'text-rose-950',
    bgBrief: 'bg-rose-50/80',
    borderBrief: 'border-rose-300',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900 border-rose-300',
    icon: '🗑️',
  },
  meat_bones: {
    name: 'Meat & Bones',
    sub: 'Orange Lid Bin',
    lidLabel: '🟠 Orange Lid: Meat & Bones',
    lidColor: 'bg-orange-500',
    lidBorder: 'border-orange-600',
    accentText: 'text-orange-950',
    bgBrief: 'bg-orange-50/80',
    borderBrief: 'border-orange-300',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-900 border-orange-300',
    icon: '🍖',
  },
};

export const ContaminationDetective: React.FC = () => {
  const { recordDetectiveCompleted } = useGame();
  const [scenariosList, setScenariosList] = useState<ContaminationScenario[]>(CONTAMINATION_SCENARIOS);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [revealedItemIds, setRevealedItemIds] = useState<string[]>([]);
  const [selectedContaminantIds, setSelectedContaminantIds] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<string>('all');

  // Filter scenarios if user selected a stream
  const filteredScenarios = useMemo(() => {
    if (streamFilter === 'all') return scenariosList;
    return scenariosList.filter(s => {
      const b = s.binTarget.toLowerCase();
      if (streamFilter === 'meat_bones') return b === 'meat_bones';
      if (streamFilter === 'e_waste') return b === 'e_waste';
      if (streamFilter === 'hard_rubbish') return b === 'hard_rubbish';
      if (streamFilter === 'medical_waste') return b === 'medical_waste';
      if (streamFilter === 'commingled_recycling') return b === 'commingled_recycling' || b === 'recycling';
      if (streamFilter === 'organic') return b === 'organic' || b === 'compost';
      if (streamFilter === 'paper_cardboard') return b === 'paper_cardboard';
      if (streamFilter === 'general_waste') return b === 'general_waste' || b === 'landfill';
      return false;
    });
  }, [scenariosList, streamFilter]);

  const activePool = filteredScenarios.length > 0 ? filteredScenarios : scenariosList;
  const currentScenario = activePool[scenarioIndex % activePool.length] || scenariosList[0];

  const actualContaminants = currentScenario.items.filter(item => item.isContaminant);
  const foundContaminantsCount = selectedContaminantIds.filter(id => {
    const item = currentScenario.items.find(i => i.id === id);
    return item?.isContaminant;
  }).length;

  const currentStreamStyle = STREAM_STYLES[currentScenario.binTarget] || STREAM_STYLES.commingled_recycling;

  const handleGenerateAiPuzzle = async (specificStream?: string) => {
    setIsGeneratingAi(true);
    setGenerationNotice(null);
    try {
      const target = specificStream || (streamFilter !== 'all' ? streamFilter : undefined);
      const res = await fetch('/api/generate-contamination-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBin: target,
          recentTitles: scenariosList.map(s => s.title),
        }),
      });

      if (!res.ok) throw new Error('Generation failed');
      const newScenario: ContaminationScenario = await res.json();

      setScenariosList(prev => [newScenario, ...prev]);
      setScenarioIndex(0);
      setRevealedItemIds([]);
      setSelectedContaminantIds([]);
      setIsCompleted(false);
      setGenerationNotice(`Generated new AI audit: "${newScenario.title}"!`);
      sound.playSuccess();

      setTimeout(() => setGenerationNotice(null), 5000);
    } catch {
      // Fallback: move to next scenario in pool
      handleNextScenario();
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleItemClick = (itemId: string) => {
    if (revealedItemIds.includes(itemId)) return;

    const item = currentScenario.items.find(i => i.id === itemId);
    if (!item) return;

    sound.playClick();
    setRevealedItemIds(prev => [...prev, itemId]);

    if (item.isContaminant) {
      sound.playSuccess();
      const updatedSelected = [...selectedContaminantIds, itemId];
      setSelectedContaminantIds(updatedSelected);

      // Check if all contaminants found
      const newFoundCount = updatedSelected.filter(id => {
        const it = currentScenario.items.find(i => i.id === id);
        return it?.isContaminant;
      }).length;

      if (newFoundCount === actualContaminants.length) {
        setIsCompleted(true);
        recordDetectiveCompleted(true);
      }
    } else {
      sound.playError();
      setSelectedContaminantIds(prev => [...prev, itemId]);
    }
  };

  const handleNextScenario = () => {
    setRevealedItemIds([]);
    setSelectedContaminantIds([]);
    setIsCompleted(false);
    setScenarioIndex(prev => (prev + 1) % activePool.length);
  };

  const handleResetScenario = () => {
    setRevealedItemIds([]);
    setSelectedContaminantIds([]);
    setIsCompleted(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header Card with Unlimited AI Generation Controls */}
      <div className="glass-strong rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 bg-amber-100 text-amber-900 rounded-2xl text-xl shadow-2xs">🕵️</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                Contamination Detective
              </h2>
              <span className="inline-flex items-center gap-1 text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                <InfinityIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unlimited AI Puzzles ({scenariosList.length})</span>
              </span>
              {currentScenario.isAiGenerated && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>AI Generated Case</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-stone-500 mt-1.5 leading-relaxed">
              Find the batch-spoiling items hiding in plain sight across <strong>Red</strong> (General), <strong>Yellow</strong> (Recycling), <strong>Green</strong> (Organic), <strong>Orange</strong> (Meat & Bones), <strong>Blue</strong> (Paper), <strong>White</strong> (Medical Waste), <strong>Hard Rubbish</strong> (Bulky Waste), and <strong>Designated Drop-Off</strong> (E-Waste & Batteries)!
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Generate Unlimited AI Case Button */}
            <button
              id="btn-generate-ai-puzzle"
              onClick={() => handleGenerateAiPuzzle()}
              disabled={isGeneratingAi}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Generate a brand-new unique contamination scenario using Gemini AI"
            >
              {isGeneratingAi ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-emerald-200" />
              )}
              <span>{isGeneratingAi ? 'Synthesizing Puzzle...' : '⚡ Generate New AI Case'}</span>
            </button>

            <button
              id="btn-reset-detective"
              onClick={handleResetScenario}
              className="text-xs font-bold text-stone-600 hover:text-stone-900 px-3.5 py-2.5 rounded-2xl border border-stone-200 hover:bg-stone-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Stream Filter Pills */}
        <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            <button
              id="stream-filter-all"
              onClick={() => { setStreamFilter('all'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                streamFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Streams (∞)
            </button>
            <button
              id="stream-filter-meat-bones"
              onClick={() => { setStreamFilter('meat_bones'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'meat_bones'
                  ? 'bg-orange-500 text-white shadow-2xs'
                  : 'bg-orange-50 text-orange-900 hover:bg-orange-100 border border-orange-300'
              }`}
            >
              <span>🟠 Orange: Meat & Bones</span>
            </button>
            <button
              id="stream-filter-ewaste"
              onClick={() => { setStreamFilter('e_waste'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'e_waste'
                  ? 'bg-stone-900 text-amber-300 shadow-2xs'
                  : 'bg-stone-100 text-stone-800 hover:bg-stone-200 border border-stone-300'
              }`}
            >
              <span>🔌 E-Waste Drop-Off</span>
            </button>
            <button
              id="stream-filter-hard-rubbish"
              onClick={() => { setStreamFilter('hard_rubbish'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'hard_rubbish'
                  ? 'bg-amber-800 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <span>🛋️ Hard Rubbish</span>
            </button>
            <button
              id="stream-filter-medical"
              onClick={() => { setStreamFilter('medical_waste'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'medical_waste'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-300'
              }`}
            >
              <span>⚪ White: Medical</span>
            </button>
            <button
              id="stream-filter-recycle"
              onClick={() => { setStreamFilter('commingled_recycling'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'commingled_recycling'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <span>🟡 Yellow: Recycling</span>
            </button>
            <button
              id="stream-filter-organic"
              onClick={() => { setStreamFilter('organic'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'organic'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300'
              }`}
            >
              <span>🟢 Green: Organic</span>
            </button>
            <button
              id="stream-filter-paper"
              onClick={() => { setStreamFilter('paper_cardboard'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'paper_cardboard'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-300'
              }`}
            >
              <span>🔵 Blue: Paper</span>
            </button>
            <button
              id="stream-filter-general-waste"
              onClick={() => { setStreamFilter('general_waste'); setScenarioIndex(0); handleResetScenario(); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                streamFilter === 'general_waste'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-300'
              }`}
            >
              <span>🔴 Red: General Waste</span>
            </button>
          </div>

          <span className="text-[11px] font-bold text-stone-500 shrink-0">
            Case #{((scenarioIndex % activePool.length) + 1)} of {activePool.length}
          </span>
        </div>
      </div>

      {/* AI Notification Toast */}
      {generationNotice && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-indigo-50 border border-indigo-300 text-indigo-900 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>{generationNotice}</span>
          </div>
          <span className="text-[10px] bg-indigo-200/80 px-2 py-0.5 rounded-md font-extrabold">Ready to Inspect</span>
        </motion.div>
      )}

      {/* Scenario Briefing Card with Distinct Stream Visual Styling */}
      <div className={`border-2 rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all ${currentStreamStyle.bgBrief} ${currentStreamStyle.borderBrief}`}>
        {/* Stream Lid Top Accent Banner */}
        <div className={`-mt-6 -mx-6 sm:-mt-7 sm:-mx-7 mb-5 px-5 py-2.5 text-white flex items-center justify-between shadow-2xs ${currentStreamStyle.lidColor} ${currentStreamStyle.lidBorder} border-b`}>
          <div className="flex items-center gap-2">
            <span className="text-base">{currentStreamStyle.icon}</span>
            <span className={`text-xs sm:text-sm font-black tracking-wide uppercase ${currentScenario.binTarget === 'medical_waste' ? 'text-rose-950' : 'text-white'}`}>
              {currentScenario.binTarget === 'e_waste' ? currentStreamStyle.lidLabel : `${currentStreamStyle.lidLabel} Stream`}
            </span>
          </div>
          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${currentScenario.binTarget === 'medical_waste' ? 'bg-rose-100 text-rose-900 border border-rose-200' : 'bg-black/20 text-white'}`}>
            Audit Focus: {currentStreamStyle.name}
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-stone-900 text-white rounded-2xl shadow-xs shrink-0">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-black text-stone-900">
                {currentScenario.title}
              </h3>
              {currentScenario.isAiGenerated && (
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  Gemini AI Synthesized
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-stone-700 mt-2 leading-relaxed font-normal">
              {currentScenario.description}
            </p>
            <div className="mt-3.5 flex items-start sm:items-center gap-2 text-xs font-bold text-stone-800 bg-white/70 p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <span>Detective Forensic Clue: {currentScenario.tips}</span>
            </div>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="mt-5 pt-4 border-t border-stone-300/60 flex items-center justify-between text-xs font-bold text-stone-800">
          <span className="flex items-center gap-1.5">
            <span>Contaminants Identified:</span>
            <span className="text-stone-500 font-normal">({actualContaminants.length} batch hazards to find)</span>
          </span>
          <span className="bg-white px-3.5 py-1.5 rounded-full border border-stone-300 text-stone-900 shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{foundContaminantsCount} / {actualContaminants.length} Caught</span>
          </span>
        </div>
      </div>

      {/* Interactive Conveyor Sorting Table Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentScenario.items.map(item => {
          const isRevealed = revealedItemIds.includes(item.id);

          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: isRevealed ? 1 : 1.02 }}
              whileTap={{ scale: isRevealed ? 1 : 0.98 }}
              onClick={() => handleItemClick(item.id)}
              id={`detective-item-${item.id}`}
              className={`p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                !isRevealed
                  ? 'glass glass-hover hover:border-amber-400/60'
                  : item.isContaminant
                  ? 'bg-rose-50/90 border-rose-400 text-rose-950 shadow-md shadow-rose-900/10'
                  : 'bg-emerald-50/90 border-emerald-400 text-emerald-950 shadow-md shadow-emerald-900/10'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <span className="text-4xl p-2.5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs shrink-0">
                  {item.emoji}
                </span>

                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm text-stone-900 leading-snug">
                    {item.name}
                  </h4>

                  {!isRevealed ? (
                    <span className="inline-block mt-2.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                      Tap to inspect item
                    </span>
                  ) : (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        {item.isContaminant ? (
                          <span className="text-xs font-black text-rose-800 bg-rose-200/90 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                            CONTAMINANT!
                          </span>
                        ) : (
                          <span className="text-xs font-black text-emerald-900 bg-emerald-200/90 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                            ACCEPTABLE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-800 font-medium leading-relaxed">
                        {item.explanation}
                      </p>
                      {item.isContaminant && (
                        <div className="text-[11px] text-rose-900 font-semibold pt-1.5 border-t border-rose-200">
                          ⚠️ Hazard Consequence: {item.consequence}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Completion Banner */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-3xl p-6 sm:p-8 text-center shadow-xl relative overflow-hidden border border-emerald-400"
          >
            <div className="max-w-lg mx-auto space-y-3.5">
              <div className="w-16 h-16 mx-auto bg-white/20 backdrop-blur-xs rounded-2xl flex items-center justify-center text-3xl shadow-xs">
                🌟
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                Stream Purified! Batch Certified!
              </h3>
              <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
                You successfully detected every single batch contaminant and prevented costly facility fires, machinery breakdowns, and pathogen hazards!
              </p>
              <div className="inline-block bg-white text-emerald-950 font-black text-xs px-3.5 py-1 rounded-full shadow-2xs">
                +60 Detective XP Awarded
              </div>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  id="btn-next-ai-detective-scenario"
                  onClick={() => handleGenerateAiPuzzle()}
                  disabled={isGeneratingAi}
                  className="inline-flex items-center gap-2 bg-stone-900 hover:bg-black text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
                  <span>Generate Next AI Case</span>
                </button>
                <button
                  id="btn-next-detective-scenario"
                  onClick={handleNextScenario}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all border border-white/30 cursor-pointer"
                >
                  <span>Cycle to Next Case</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

