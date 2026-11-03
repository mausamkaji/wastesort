import React, { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Lightbulb, ArrowLeft, Factory, Eye, MapPin } from 'lucide-react';
import { HOUSEHOLD_BINS } from '../data/householdBins';
import { HOUSEHOLD_DROPOFFS } from '../data/householdDropoffs';
import { HouseholdTools, BinFocus } from './HouseholdTools';

interface HouseholdGuideProps {
  onBack: () => void;
  onSwitchToIndustry: () => void;
}

export const HouseholdGuide: React.FC<HouseholdGuideProps> = ({ onBack, onSwitchToIndustry }) => {
  // While a search/AI result is active, only the bin it belongs to is shown.
  const [focus, setFocus] = useState<BinFocus>(null);
  const [showAll, setShowAll] = useState(false);

  const handleFocusChange = useCallback((next: BinFocus) => {
    setFocus(next);
    setShowAll(false);
  }, []);

  const filtering = focus !== null && !showAll;
  const visibleBins = filtering ? HOUSEHOLD_BINS.filter(b => b.id === focus) : HOUSEHOLD_BINS;
  const visibleDropoffs = filtering ? HOUSEHOLD_DROPOFFS.filter(d => d.id === focus) : HOUSEHOLD_DROPOFFS;
  const focusIsDropoff = focus !== null && HOUSEHOLD_DROPOFFS.some(d => d.id === focus);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <button
          id="household-back"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900 bg-white/60 hover:bg-white/80 border border-stone-200/70 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Change view
        </button>
        <button
          id="household-to-industry"
          type="button"
          onClick={onSwitchToIndustry}
          className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <Factory className="w-4 h-4" />
          Switch to Industry
        </button>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
          Household bin guide
        </h1>
        <p className="mt-3 text-stone-600 max-w-2xl mx-auto">
          Four bins cover almost everything at home, and three drop-off points take clothes, electronics and soft plastics. Rules can differ slightly between councils, so check yours if you are unsure.
        </p>
      </div>

      <HouseholdTools onFocusChange={handleFocusChange} />

      {focus !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5" id="household-focus-bar">
          <p className="text-sm font-semibold text-stone-700">
            {showAll
              ? 'Showing all bins and drop-off points'
              : focus === 'none'
                ? 'This item does not belong in any of your four bins.'
                : focusIsDropoff
                  ? 'Showing the drop-off point for your result'
                  : 'Showing the bin for your result'}
          </p>
          <button
            id="household-toggle-all"
            type="button"
            onClick={() => setShowAll(s => !s)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 bg-white/70 hover:bg-white border border-stone-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            {showAll ? 'Show only this bin' : 'Show all bins'}
          </button>
        </div>
      )}

      {visibleBins.length > 0 && (
      <div className={`grid grid-cols-1 gap-5 sm:gap-6 ${visibleBins.length > 1 ? 'lg:grid-cols-2' : 'max-w-2xl mx-auto'}`}>
        {visibleBins.map((bin, i) => (
          <motion.section
            key={bin.id}
            id={`household-bin-${bin.id}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className={`rounded-3xl border ${bin.border} ${bin.card} overflow-hidden shadow-sm`}
          >
            <div className={`${bin.lid} text-white px-5 sm:px-6 py-4 flex items-center gap-3`}>
              <span className="text-3xl" aria-hidden="true">{bin.emoji}</span>
              <div>
                <h2 className="text-xl font-extrabold leading-tight">{bin.name}</h2>
                <p className="text-xs sm:text-sm text-white/85 font-medium">{bin.sub}</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <p className="text-sm sm:text-base text-stone-700">{bin.summary}</p>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-800 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Goes in
                </h3>
                <ul className="space-y-1.5">
                  {bin.accepted.map(item => (
                    <li key={item} className="text-sm text-stone-700 flex gap-2">
                      <span className="text-emerald-600 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-red-800 mb-2">
                  <XCircle className="w-4 h-4" />
                  Keep out
                </h3>
                <ul className="space-y-1.5">
                  {bin.notAccepted.map(item => (
                    <li key={item} className="text-sm text-stone-700 flex gap-2">
                      <span className="text-red-500 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`flex gap-2.5 text-sm rounded-2xl border px-4 py-3 ${bin.tipBox}`}>
                <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
                <p><span className="font-bold">Tip: </span>{bin.tip}</p>
              </div>
            </div>
          </motion.section>
        ))}
      </div>
      )}

      {visibleDropoffs.length > 0 && (
        <section id="household-dropoffs" className={visibleBins.length > 0 ? 'mt-12' : ''}>
          <div className={`mb-5 ${visibleDropoffs.length > 1 ? 'text-center' : 'max-w-2xl mx-auto'}`}>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Special drop-off</h2>
            <p className="mt-2 text-stone-600">
              These never go in a kerbside bin, but they can be reused or recycled if you take them to the right place.
            </p>
          </div>

          <div className={`grid grid-cols-1 gap-5 sm:gap-6 ${visibleDropoffs.length > 1 ? 'lg:grid-cols-3' : 'max-w-2xl mx-auto'}`}>
            {visibleDropoffs.map((d, i) => (
              <motion.section
                key={d.id}
                id={`household-dropoff-${d.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className={`rounded-3xl border ${d.border} ${d.card} overflow-hidden shadow-sm`}
              >
                <div className={`${d.header} text-white px-5 py-4 flex items-center gap-3`}>
                  <span className="text-3xl" aria-hidden="true">{d.emoji}</span>
                  <div>
                    <h3 className="text-xl font-extrabold leading-tight">{d.name}</h3>
                    <p className="text-xs sm:text-sm text-white/85 font-medium">{d.sub}</p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <p className="text-sm text-stone-700">{d.summary}</p>

                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-800 mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Take
                    </h4>
                    <ul className="space-y-1.5">
                      {d.accepted.map(item => (
                        <li key={item} className="text-sm text-stone-700 flex gap-2">
                          <span className="text-emerald-600 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-red-800 mb-2">
                      <XCircle className="w-4 h-4" />
                      Keep out
                    </h4>
                    <ul className="space-y-1.5">
                      {d.notAccepted.map(item => (
                        <li key={item} className="text-sm text-stone-700 flex gap-2">
                          <span className="text-red-500 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-stone-900 mb-2">
                      <MapPin className="w-4 h-4" />
                      Where to take it
                    </h4>
                    <ul className="space-y-1.5">
                      {d.where.map(item => (
                        <li key={item} className="text-sm text-stone-700 flex gap-2">
                          <span className="text-stone-500 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`flex gap-2.5 text-sm rounded-2xl border px-4 py-3 ${d.tipBox}`}>
                    <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
                    <p><span className="font-bold">Tip: </span>{d.tip}</p>
                  </div>
                </div>
              </motion.section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
