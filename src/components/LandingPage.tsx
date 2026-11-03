import React from 'react';
import { motion } from 'motion/react';
import { Home, Factory, ArrowRight } from 'lucide-react';

export type ViewMode = 'household' | 'industry';

interface LandingPageProps {
  onSelect: (mode: ViewMode) => void;
}

const OPTIONS: {
  id: ViewMode;
  title: string;
  emoji: string;
  icon: React.ReactNode;
  description: string;
  chips: string[];
  gradient: string;
  ring: string;
  chipClass: string;
}[] = [
  {
    id: 'household',
    title: 'Household',
    emoji: '🏡',
    icon: <Home className="w-6 h-6" />,
    description: 'Simple kerbside sorting for your home. Four bins plus drop-off points for clothes, electronics and soft plastics.',
    chips: ['🌿 FOGO', '🍂 Garden', '🗑️ General', '♻️ Recycling'],
    gradient: 'from-emerald-600 to-emerald-500',
    ring: 'hover:ring-emerald-400/60',
    chipClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  {
    id: 'industry',
    title: 'Industry',
    emoji: '🏭',
    icon: <Factory className="w-6 h-6" />,
    description: 'The full WasteSort guide: every waste stream, the AI Inspector, camera scanning and the disposal encyclopedia.',
    chips: ['9 Waste Streams', 'AI Inspector', 'Encyclopedia', 'Resin Codes'],
    gradient: 'from-amber-600 to-amber-500',
    ring: 'hover:ring-amber-400/60',
    chipClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onSelect }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10 sm:mb-14"
      >
        <div className="mx-auto mb-5 w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-3xl shadow-lg shadow-emerald-900/20">
          🌍
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-900">
          Welcome to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-amber-600">WasteSort</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-stone-600 max-w-xl mx-auto">
          Know where it goes. Choose how you want to sort.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {OPTIONS.map((opt, i) => (
          <motion.button
            key={opt.id}
            id={`landing-${opt.id}`}
            type="button"
            onClick={() => onSelect(opt.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.99 }}
            className={`glass-strong group h-full flex flex-col items-start text-left rounded-3xl p-6 sm:p-8 cursor-pointer ring-2 ring-transparent ${opt.ring} transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-emerald-500`}
          >
            <div className="flex w-full items-center justify-between mb-5">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${opt.gradient} text-white flex items-center justify-center shadow-md`}>
                {opt.icon}
              </div>
              <span className="text-4xl" aria-hidden="true">{opt.emoji}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-stone-900">{opt.title}</h2>
            <p className="mt-2 text-sm sm:text-base text-stone-600 leading-relaxed">{opt.description}</p>
            <div className="mt-5 mb-6 flex flex-wrap gap-2">
              {opt.chips.map(chip => (
                <span key={chip} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${opt.chipClass}`}>
                  {chip}
                </span>
              ))}
            </div>
            <div className={`mt-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r ${opt.gradient} shadow-md group-hover:gap-3 transition-all`}>
              Continue as {opt.title}
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
