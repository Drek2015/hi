// Arena layouts. Floor at y = 0; thin platforms can be jumped through from below.
export const ARENAS = [
  {
    id: 'valley', name: 'Valley of the End', universe: 'Naruto', theme: 'valley',
    left: -1350, right: 1350, ceiling: -1250,
    platforms: [
      { x1: -1350, x2: 1350, y: 0 },
      { x1: -880, x2: -480, y: -300, thin: true },
      { x1: 480, x2: 880, y: -300, thin: true },
      { x1: -220, x2: 220, y: -520, thin: true },
    ],
  },
  {
    id: 'tower', name: 'Avengers Tower Rooftop', universe: 'Marvel', theme: 'tower',
    left: -1300, right: 1300, ceiling: -1250,
    platforms: [
      { x1: -1300, x2: 1300, y: 0 },
      { x1: -760, x2: -360, y: -330, thin: true },
      { x1: 360, x2: 760, y: -330, thin: true },
    ],
  },
  {
    id: 'kara', name: 'Otsutsuki Dimension', universe: 'Boruto', theme: 'kara',
    left: -1400, right: 1400, ceiling: -1300,
    platforms: [
      { x1: -1400, x2: 1400, y: 0 },
      { x1: -1000, x2: -640, y: -360, thin: true },
      { x1: -240, x2: 240, y: -280, thin: true },
      { x1: 640, x2: 1000, y: -360, thin: true },
    ],
  },
];
