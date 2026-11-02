import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Lightbulb, ArrowLeft, Factory } from 'lucide-react';

interface HouseholdGuideProps {
  onBack: () => void;
  onSwitchToIndustry: () => void;
}

interface HouseholdBin {
  id: string;
  name: string;
  sub: string;
  emoji: string;
  lid: string;
  card: string;
  border: string;
  tipBox: string;
  summary: string;
  accepted: string[];
  notAccepted: string[];
  tip: string;
}

const HOUSEHOLD_BINS: HouseholdBin[] = [
  {
    id: 'fogo',
    name: 'FOGO',
    sub: 'Food Organics & Garden Organics · Green lid',
    emoji: '🌿',
    lid: 'bg-emerald-600',
    card: 'bg-emerald-50/60',
    border: 'border-emerald-200',
    tipBox: 'bg-emerald-100/70 text-emerald-950 border-emerald-200',
    summary: 'Kitchen scraps and garden trimmings together, turned into compost.',
    accepted: [
      'Fruit and vegetable scraps, peelings and cores',
      'Cooked leftovers, bread, pasta and rice',
      'Eggshells, dairy, coffee grounds and tea bags',
      'Meat, bones and seafood scraps (if your council allows)',
      'Lawn clippings, leaves, weeds and flowers',
      'Certified compostable bin liners (AS 4736 / AS 5810 logo)',
    ],
    notAccepted: [
      'Plastic bags, including "biodegradable" ones',
      'Greasy pizza boxes and oily takeaway packaging',
      'Paper towels, tissues and napkins',
      'Pet waste, kitty litter and nappies',
      'Fruit stickers and plastic plant pots',
      'Treated timber',
    ],
    tip: 'Keep a small kitchen caddy by the sink and empty it every day or two to avoid smells.',
  },
  {
    id: 'garden',
    name: 'Garden',
    sub: 'Garden organics only · Lime green lid',
    emoji: '🍂',
    lid: 'bg-lime-500',
    card: 'bg-lime-50/60',
    border: 'border-lime-200',
    tipBox: 'bg-lime-100/70 text-lime-950 border-lime-200',
    summary: 'Only plant material from your yard. No food.',
    accepted: [
      'Grass clippings and lawn cuttings',
      'Leaves, twigs and small branches (under about 10 cm thick)',
      'Weeds, flowers and hedge trimmings',
      'Prunings and bark',
    ],
    notAccepted: [
      'Food scraps (these go in FOGO)',
      'Soil, rocks, sand and rubble',
      'Treated or painted timber',
      'Plastic bags, pots and garden hoses',
      'Pet waste',
      'Palm fronds and large logs (check your council)',
    ],
    tip: 'Loose is best. Do not bag your clippings, because plastic bags contaminate the whole load.',
  },
  {
    id: 'general',
    name: 'General',
    sub: 'Landfill · Red lid',
    emoji: '🗑️',
    lid: 'bg-red-600',
    card: 'bg-red-50/60',
    border: 'border-red-200',
    tipBox: 'bg-red-100/70 text-red-950 border-red-200',
    summary: 'The last resort for things that cannot be recycled or composted.',
    accepted: [
      'Soft plastics, chip packets and cling wrap (or use a supermarket drop-off)',
      'Nappies and pet waste',
      'Greasy pizza boxes',
      'Paper towels, tissues and napkins',
      'Broken ceramics, drinking glasses and pyrex',
      'Disposable coffee cups and polystyrene',
    ],
    notAccepted: [
      'Anything recyclable (bottles, cans, paper, cardboard)',
      'Food scraps if you have a FOGO bin',
      'Batteries, e-waste and light globes',
      'Paint, chemicals and gas bottles',
      'Medical sharps',
    ],
    tip: 'If you are unsure and it is not hazardous, general waste is safer than contaminating a recycling or FOGO bin.',
  },
  {
    id: 'recycling',
    name: 'Recycling',
    sub: 'Commingled recycling · Yellow lid',
    emoji: '♻️',
    lid: 'bg-amber-500',
    card: 'bg-amber-50/60',
    border: 'border-amber-200',
    tipBox: 'bg-amber-100/70 text-amber-950 border-amber-200',
    summary: 'Clean, empty packaging and paper, placed in the bin loose.',
    accepted: [
      'Plastic bottles, tubs and containers (lids on)',
      'Glass bottles and jars',
      'Aluminium and steel cans',
      'Paper, newspapers and flattened cardboard',
      'Milk and juice cartons',
      'Aluminium foil scrunched into a fist-sized ball',
    ],
    notAccepted: [
      'Soft plastics, bags and wrappers',
      'Broken glass, drinking glasses and ceramics',
      'Food-soiled or greasy packaging',
      'Batteries and electronics (a fire risk)',
      'Nappies and polystyrene',
      'Recyclables tied up in plastic bags',
    ],
    tip: 'Give containers a quick rinse, leave the lids on, and keep everything loose in the bin.',
  },
];

export const HouseholdGuide: React.FC<HouseholdGuideProps> = ({ onBack, onSwitchToIndustry }) => {
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
          Four bins cover almost everything at home. Rules can differ slightly between councils, so check yours if you are unsure.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {HOUSEHOLD_BINS.map((bin, i) => (
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
    </div>
  );
};
