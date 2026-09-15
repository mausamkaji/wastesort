export interface ResinCodeInfo {
  code: number;
  abbreviation: string;
  fullName: string;
  commonProducts: string[];
  recyclabilityStatus: 'Widely Recycled' | 'Limited Recycled' | 'Rarely / Drop-Off Only' | 'Difficult / Specialist';
  colorClass: string;
  description: string;
  safetyNote: string;
}

export const RESIN_CODES: ResinCodeInfo[] = [
  {
    code: 1,
    abbreviation: 'PET / PETE',
    fullName: 'Polyethylene Terephthalate',
    commonProducts: ['Water & soda bottles', 'Salad dressing containers', 'Peanut butter jars', 'Mouthwash bottles'],
    recyclabilityStatus: 'Widely Recycled',
    colorClass: 'text-sky-700 bg-sky-50 border-sky-200',
    description: 'The global gold standard of rigid recyclable plastic. Clear, strong, and lightweight. Melted and spun into carpet fibers, fleece jackets, and new food-grade bottles.',
    safetyNote: 'Intended for single-use containers; repeated washing with hot water can harbor bacterial buildup in micro-cracks.'
  },
  {
    code: 2,
    abbreviation: 'HDPE',
    fullName: 'High-Density Polyethylene',
    commonProducts: ['Milk jugs', 'Laundry detergent bottles', 'Shampoo containers', 'Bleach bottles'],
    recyclabilityStatus: 'Widely Recycled',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    description: 'Extremely durable, moisture-resistant, and high chemical resistance. Highly sought after by plastic reclaimers for composite lumber, agricultural pipes, and buckets.',
    safetyNote: 'Considered one of the safest plastics with low chemical leach potential.'
  },
  {
    code: 3,
    abbreviation: 'PVC',
    fullName: 'Polyvinyl Chloride',
    commonProducts: ['Plumbing pipes', 'Vinyl flooring', 'Medical tubing', 'Blister packaging', 'Shower curtains'],
    recyclabilityStatus: 'Difficult / Specialist',
    colorClass: 'text-amber-800 bg-amber-50 border-amber-200',
    description: 'Contains high chlorine content. Almost never collected in municipal curbside bins because it ruins standard polyester and polyolefin recycling melt streams.',
    safetyNote: 'Can leach phthalates and chlorine derivatives if incinerated or heated.'
  },
  {
    code: 4,
    abbreviation: 'LDPE',
    fullName: 'Low-Density Polyethylene',
    commonProducts: ['Grocery produce bags', 'Squeeze bottles (ketchup/mustard)', 'Bread bags', 'Shrink wrap'],
    recyclabilityStatus: 'Rarely / Drop-Off Only',
    colorClass: 'text-teal-700 bg-teal-50 border-teal-200',
    description: 'Flexible, stretchy plastic film. It must NOT be placed in curbside bins because it wraps around sorting rotating discs. Bring to store film drop-off bins instead.',
    safetyNote: 'Safe and flexible, excellent moisture barrier.'
  },
  {
    code: 5,
    abbreviation: 'PP',
    fullName: 'Polypropylene',
    commonProducts: ['Yogurt tubs', 'Medicine prescription bottles', 'Takeout soup containers', 'Plastic bottle caps', 'Syrup bottles'],
    recyclabilityStatus: 'Widely Recycled',
    colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    description: 'High melting point makes it ideal for hot liquids and microwave-safe dishes. Acceptance in curbside programs has grown rapidly over the last 5 years.',
    safetyNote: 'Durable, heat resistant, and food-safe.'
  },
  {
    code: 6,
    abbreviation: 'PS',
    fullName: 'Polystyrene / Styrofoam',
    commonProducts: ['Disposable coffee cup lids', 'Plastic cutlery', 'Styrofoam takeout clamshells', 'Egg cartons', 'Packing foam peanuts'],
    recyclabilityStatus: 'Rarely / Drop-Off Only',
    colorClass: 'text-rose-700 bg-rose-50 border-rose-200',
    description: 'Cheap, brittle, or expanded with 95% air. Extremely expensive and inefficient to transport and clean, so >98% of municipal programs reject it from curbside bins.',
    safetyNote: 'Can leach styrene monomers when exposed to high heat and fatty foods.'
  },
  {
    code: 7,
    abbreviation: 'OTHER',
    fullName: 'Miscellaneous, Polycarbonate, Acrylic & Bioplastics (PLA)',
    commonProducts: ['Baby bottles (older)', 'Safety glasses', 'PLA compostable cups', 'Nylon', 'Multi-layer food pouches'],
    recyclabilityStatus: 'Difficult / Specialist',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
    description: 'A catch-all category for custom multi-material resins or bioplastics. Includes both non-recyclable composite laminates and industrially compostable PLA.',
    safetyNote: 'Some resin #7 plastics historically contained BPA; modern bio-based plastics also fall under #7.'
  }
];
