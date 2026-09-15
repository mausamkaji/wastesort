import { TriviaQuestion } from '../types';

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 'triv_1',
    question: 'How clean do plastic and glass containers need to be before entering the recycling bin?',
    options: [
      'They must be run through a dishwasher with hot soapy water',
      'They only need to be empty and given a quick swish/rinse with cold water',
      'They should never be rinsed at all because water is too precious',
      'Labels and glue must be meticulously soaked off with acetone'
    ],
    correctIndex: 1,
    explanation: 'Over-washing wastes clean potable water and energy! A simple scrape with a spatula and a quick rinse to remove visible food chunks is all that is required for modern recycling facilities.',
    ecoFact: 'Don\'t run your dishwasher just to clean recycling. A quick 2-second rinse is more than enough.',
    difficulty: 'easy'
  },
  {
    id: 'triv_2',
    question: 'Should you screw plastic bottle caps back ON or throw them loose into the recycling bin?',
    options: [
      'Throw them loose into the bin',
      'Leave them screwed ON tightly to the bottle',
      'Never put caps in recycling, always throw them in the trash',
      'Melt them together on your stove first'
    ],
    correctIndex: 1,
    explanation: 'Modern recycling guidelines instruct leaving caps screwed ON. Loose caps are smaller than 2-3 inches and fall through the initial trommel sorting screens straight into landfill trash.',
    ecoFact: 'During the recycling washing process, the bottles (PET #1) sink while caps (PP #5) float, easily separating by density!',
    difficulty: 'medium'
  },
  {
    id: 'triv_3',
    question: 'What is the environmental term "Wishcycling"?',
    options: [
      'Wishing for more government funding for municipal green parks',
      'Putting non-recyclable items into the recycling bin hoping they will be recycled',
      'Riding a bicycle while collecting roadside trash',
      'Donating old bicycles to charity organizations'
    ],
    correctIndex: 1,
    explanation: 'Wishcycling is the practice of tossing questionable items into the recycling bin out of good intentions. Unfortunately, it clogs sorting machinery, ruins clean batches, and costs facilities millions in disposal fees.',
    ecoFact: 'When in doubt, remember the golden rule: "When in doubt, check it out, or throw it out!"',
    difficulty: 'easy'
  },
  {
    id: 'triv_4',
    question: 'How much energy is saved by recycling an aluminum beverage can compared to making a brand new one from raw bauxite ore?',
    options: [
      'About 15%',
      'About 45%',
      'About 70%',
      'Up to 95%'
    ],
    correctIndex: 3,
    explanation: 'Smelting raw bauxite ore into virgin aluminum is one of the most energy-intensive industrial processes on Earth. Recycling aluminum saves a staggering 95% of that energy and produces 95% fewer greenhouse emissions.',
    ecoFact: 'The energy saved by recycling just one single aluminum can could power your television for three hours.',
    difficulty: 'medium'
  },
  {
    id: 'triv_5',
    question: 'Why is black plastic takeout packaging rarely recycled by municipal recycling facilities?',
    options: [
      'Black plastic is poisonous to touch',
      'Near-infrared (NIR) optical sorting sensors cannot detect black pigment',
      'Black plastic cannot be melted by heat',
      'Recycling regulations prohibit dark colors'
    ],
    correctIndex: 1,
    explanation: 'Most modern recycling plants rely on Near-Infrared (NIR) light beams to automatically identify plastic chemistry. Carbon black pigment absorbs the infrared light, reflecting nothing back, causing the optical sensor to register the conveyor belt as empty.',
    ecoFact: 'Many food manufacturers are switching to unpigmented clear or grey plastics so optical sorters can recognize them.',
    difficulty: 'hard'
  },
  {
    id: 'triv_6',
    question: 'What gas is produced when organic food waste is buried in an airtight landfill instead of composted?',
    options: [
      'Argon',
      'Nitrous Oxide',
      'Methane (CH4)',
      'Helium'
    ],
    correctIndex: 2,
    explanation: 'In landfills, organic waste is crushed without oxygen (anaerobic conditions), which generates methane. Methane is over 28 times more potent than carbon dioxide at trapping heat in our atmosphere over 100 years.',
    ecoFact: 'Composting is aerobic (with oxygen), producing nutrient-rich humus and water rather than methane gas.',
    difficulty: 'medium'
  },
  {
    id: 'triv_7',
    question: 'What is the main danger of tossing rechargeable lithium batteries into regular curbside trash or recycling?',
    options: [
      'They cause sorting cameras to turn off',
      'They crush into dust and attract rodents',
      'They spark or explode under compression, causing severe fires',
      'They corrode conveyor belts with acid within 5 minutes'
    ],
    correctIndex: 2,
    explanation: 'Lithium-ion batteries have energetic chemicals that spark, violently overheat (thermal runaway), and explode when compacted by garbage truck hydraulics or punctured by sorting discs.',
    ecoFact: 'Lithium batteries are responsible for hundreds of waste plant and garbage truck fires every single year.',
    difficulty: 'easy'
  },
  {
    id: 'triv_8',
    question: 'Can clean paper receipts from retail cash registers be recycled with regular office paper?',
    options: [
      'Yes, all paper can be recycled together',
      'No, because thermal receipts are coated with chemical heat developers like BPA or BPS',
      'Yes, as long as you tear them into small shreds',
      'Only if the store was an eco-certified business'
    ],
    correctIndex: 1,
    explanation: 'Thermal receipt paper is coated with bisphenols (BPA/BPS). Recycling them introduces these toxic endocrine disruptors into recycled paper products like napkins and toilet paper, where they touch human skin.',
    ecoFact: 'Say "No receipt, please" or ask for an email receipt to keep endocrine disruptors out of the paper loop.',
    difficulty: 'hard'
  },
  {
    id: 'triv_9',
    question: 'What is the Waste Hierarchy (the "3 Rs") listed in true order of environmental priority?',
    options: [
      'Recycle, Reduce, Reuse',
      'Reuse, Recycle, Reduce',
      'Reduce, Reuse, Recycle',
      'Recycle, Landfill, Compost'
    ],
    correctIndex: 2,
    explanation: 'Recycling is actually the LAST line of defense! Reducing consumption prevents resource extraction and emissions entirely, Reusing keeps existing items in circulation, and Recycling handles what remains.',
    ecoFact: 'The greenest product is the one that was never manufactured in the first place.',
    difficulty: 'easy'
  },
  {
    id: 'triv_10',
    question: 'What is the "Scrunch Test" used for flexible packaging?',
    options: [
      'Testing if an apple is ripe for composting',
      'Scrunching foil or plastic: if it springs back flat, it is soft plastic; if it stays scrunched, it is pure foil',
      'Crushing cans with your foot to save bin space',
      'Checking if cardboard box glue is water-soluble'
    ],
    correctIndex: 1,
    explanation: 'Scrunch metallic packaging in your fist. If it springs open, it is plastic-coated film (landfill/special collection). If it remains scrunched into a tight crinkle ball, it is pure aluminum foil and can be recycled when balled up!',
    ecoFact: 'The scrunch test is a quick way to test chocolate wrappers, snack bags, and baking foil at home.',
    difficulty: 'medium'
  }
];
