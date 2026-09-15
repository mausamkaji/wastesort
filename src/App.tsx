/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProvider } from './context/GameContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { BinMasterGame } from './components/BinMasterGame';
import { ContaminationDetective } from './components/ContaminationDetective';
import { TriviaChallenge } from './components/TriviaChallenge';
import { AiInspectorAndEncyclopedia } from './components/AiInspectorAndEncyclopedia';
import { DailyChallengeNotification } from './components/DailyChallengeNotification';
import { Sparkles } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [inspectorSubTab, setInspectorSubTab] = useState<'ai_inspector' | 'catalog' | 'resin_codes'>('ai_inspector');

  const handleNavigate = (tab: ActiveTab, subTab?: 'ai_inspector' | 'catalog' | 'resin_codes') => {
    setActiveTab(tab);
    if (subTab) {
      setInspectorSubTab(subTab);
    }
  };

  return (
    <div className="relative min-h-screen bg-stone-50 flex flex-col selection:bg-amber-100 selection:text-green-900 overflow-hidden">
      {/* Ambient decorative background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-96 h-96 bg-green-300/25 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Top sticky Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Daily Challenge Global Notification */}
      <DailyChallengeNotification />

      {/* Main View based on tab */}
      <main className="flex-1 pb-16">
        {activeTab === 'home' && <HomePage onNavigate={handleNavigate} />}
        {activeTab === 'bin_master' && <BinMasterGame />}
        {activeTab === 'contamination_detective' && <ContaminationDetective />}
        {activeTab === 'trivia' && <TriviaChallenge />}
        {activeTab === 'ai_inspector' && (
          <AiInspectorAndEncyclopedia
            initialSubTab={inspectorSubTab}
            onSubTabChange={(st) => setInspectorSubTab(st)}
          />
        )}
      </main>

      {/* Global Footer */}
      <footer className="relative bg-white/80 backdrop-blur-sm border-t border-stone-200 py-6 px-4 sm:px-6 mt-auto">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-700 to-amber-700">WasteSort Quest</span>
            <span>•</span>
            <span>Gamified Waste Management & Circular Economy Guide</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Grounded in modern Materials Recovery Facility (MRF) standards</span>
          </div>
        </div>
        </footer>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
