export interface HouseholdBin {
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

export const HOUSEHOLD_BINS: HouseholdBin[] = [
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

