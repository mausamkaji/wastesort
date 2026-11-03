export interface HouseholdDropoff {
  id: string;
  name: string;
  sub: string;
  emoji: string;
  header: string;
  card: string;
  border: string;
  tipBox: string;
  summary: string;
  accepted: string[];
  notAccepted: string[];
  where: string[];
  tip: string;
}

/** Items that never go in a kerbside bin but can be reused or recycled at a drop-off point. */
export const HOUSEHOLD_DROPOFFS: HouseholdDropoff[] = [
  {
    id: 'clothing',
    name: 'Clothes & textiles',
    sub: 'Charity bins, op shops and textile collections',
    emoji: '👕',
    header: 'bg-violet-600',
    card: 'bg-violet-50/60',
    border: 'border-violet-200',
    tipBox: 'bg-violet-100/70 text-violet-950 border-violet-200',
    summary: 'Wearable clothing and linen get a second life. Fabric jams sorting machines, so it never goes in a bin.',
    accepted: [
      'Clean, wearable clothes and shoes (tie pairs together)',
      'Towels, sheets, blankets and curtains',
      'Bags, belts, hats and scarves',
      'Worn-out textiles, if the collection says it takes them for rags or recycling',
    ],
    notAccepted: [
      'Wet, mouldy or oil-soaked items',
      'Mattresses, pillows and doonas (check your council hard rubbish service)',
      'Rubbish or odd socks mixed into the bag',
    ],
    where: [
      'Charity donation bins and op shops (for example Salvos and Vinnies)',
      'Council textile collections and drop-off days',
      'Retailer clothing take-back schemes',
    ],
    tip: 'Wash and bag items first, and keep them dry. Torn or stained textiles that nobody will take go in the General bin, never recycling.',
  },
  {
    id: 'ewaste',
    name: 'Electronics & batteries',
    sub: 'E-waste and battery drop-off points',
    emoji: '🔌',
    header: 'bg-sky-600',
    card: 'bg-sky-50/60',
    border: 'border-sky-200',
    tipBox: 'bg-sky-100/70 text-sky-950 border-sky-200',
    summary: 'Anything with a plug, cord or battery. These contain metals worth recovering and batteries that start fires in bins and trucks.',
    accepted: [
      'Phones, tablets, laptops, chargers and cables',
      'TVs, monitors, computers and printers',
      'Small appliances, torches, toys and tools with a cord or battery',
      'Household batteries: AA, AAA, button cells and rechargeables',
    ],
    notAccepted: [
      'Paint, oil, gas bottles and chemicals (use a council hazardous waste drop-off)',
      'Any battery or electronic item in the recycling, FOGO or General bin',
    ],
    where: [
      'Your council resource recovery centre or transfer station',
      'Battery drop-off bins at supermarkets and hardware stores',
      'Electronics retailers and TV and computer recycling drop-off points',
    ],
    tip: 'Wipe personal data first. Tape over the terminals of lithium and 9V batteries, and never put a damaged battery in a bin.',
  },
  {
    id: 'softplastics',
    name: 'Soft plastics',
    sub: 'Recyclable packaging film at a drop-off point',
    emoji: '🛍️',
    header: 'bg-teal-600',
    card: 'bg-teal-50/60',
    border: 'border-teal-200',
    tipBox: 'bg-teal-100/70 text-teal-950 border-teal-200',
    summary: 'Clean, dry plastic packaging that scrunches into a ball. It tangles sorting machines, so it stays out of your recycling bin.',
    accepted: [
      'Bread bags and frozen food bags',
      'Chip, snack and confectionery packets',
      'Pasta, rice and cereal bags',
      'Cling wrap and plastic shopping bags (clean and dry)',
    ],
    notAccepted: [
      'Wet, greasy or food-soiled wrappers (General bin)',
      'Compostable or "biodegradable" bags',
      'Rigid bottles, tubs and lids (recycling bin)',
      'Nappies and pet waste bags',
    ],
    where: [
      'A participating supermarket soft plastics drop-off bin',
      'Council soft plastics collection points, where offered',
    ],
    tip: 'Collect them in one bag at home and drop it off with your shopping. Availability has changed over time, so check a drop-off is open near you. If there is none, use the General bin.',
  },
];
