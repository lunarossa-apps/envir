import type {
  AppState,
  BudgetLevel,
  HungerLevel,
  MoodEntry,
  Suggestion,
  SuggestionPreference,
  TimeSlot,
  WeatherMode,
} from './types';

const timeSlots: { label: TimeSlot; from: number; to: number }[] = [
  { label: 'mattina', from: 6, to: 11 },
  { label: 'pranzo', from: 11, to: 14 },
  { label: 'pomeriggio', from: 14, to: 18 },
  { label: 'aperitivo', from: 18, to: 20 },
  { label: 'sera', from: 20, to: 23 },
  { label: 'notte', from: 23, to: 24 },
];

export function getCurrentTimeSlot(date = new Date()): TimeSlot {
  const hour = date.getHours();
  return timeSlots.find((slot) => hour >= slot.from && hour < slot.to)?.label || 'notte';
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

function topEntry<T extends string>(items: T[], fallback: T): T {
  const counts = countBy(items);
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as T) || fallback;
}

function averageBudget(moods: MoodEntry[]): BudgetLevel {
  const values = { basso: 1, medio: 2, alto: 3 };
  const total = moods.reduce((sum, mood) => sum + values[mood.budget], 0);
  const avg = total / Math.max(moods.length, 1);
  if (avg <= 1.5) return 'basso';
  if (avg <= 2.4) return 'medio';
  return 'alto';
}

function hungerMood(moods: MoodEntry[]): HungerLevel {
  return topEntry(moods.map((m) => m.hunger), 'poca');
}

export function buildGroupNarrative(moods: MoodEntry[], totalMembers: number): string {
  if (!moods.length) return 'Il gruppo non ha ancora aggiornato il mood. Inizia con un check-in veloce per ottenere suggerimenti migliori.';
  const tired = moods.filter((m) => m.energy === 'bassa').length;
  const hungry = moods.filter((m) => m.hunger === 'si').length;
  const relax = moods.filter((m) => m.activity === 'relax').length;
  const food = moods.filter((m) => m.activity === 'food').length;
  const walkingLow = moods.filter((m) => m.walking === 'bassa').length;
  const budget = averageBudget(moods);

  const intro = tired >= Math.ceil(totalMembers / 2) ? 'Il gruppo sembra un po\' stanco' : 'Il gruppo sembra in buona forma';
  const appetite = hungry >= Math.ceil(totalMembers / 2)
    ? 'con voglia di mangiare qualcosa presto'
    : food >= Math.ceil(totalMembers / 3)
      ? 'con un forte focus su esperienze food'
      : 'e aperto a diverse attività';
  const pace = walkingLow >= Math.ceil(totalMembers / 2) || relax >= Math.ceil(totalMembers / 3)
    ? 'Meglio privilegiare qualcosa di tranquillo'
    : 'Si può considerare anche un\'attività dinamica';

  return `${intro}, ${appetite}. ${pace} con un budget medio percepito ${budget}.`;
}

export function generateSuggestions(state: AppState, weather: WeatherMode, preference: SuggestionPreference): Suggestion[] {
  const group = state.group;
  if (!group) return [];
  const moods = state.moods;
  const timeSlot = getCurrentTimeSlot();
  const hungry = moods.filter((m) => m.hunger === 'si').length;
  const lowEnergy = moods.filter((m) => m.energy === 'bassa').length;
  const highEnergy = moods.filter((m) => m.energy === 'alta').length;
  const highWalking = moods.filter((m) => m.walking === 'alta').length;
  const activity = topEntry(moods.map((m) => m.activity), 'libero');
  const budget = averageBudget(moods);
  const people = state.members.length || group.participantCount;

  const basePool = [
    {
      key: 'food-break',
      when: hungry > 0 || timeSlot === 'pranzo' || timeSlot === 'aperitivo',
      title: weather === 'pioggia' ? 'Bistrot o brunch coperto' : 'Pausa food vicina',
      description: `Una scelta pratica a ${group.destination} per fermarsi insieme senza complicazioni logistiche.`,
      reason: 'Molti segnali indicano fame o bisogno di una pausa rapida prima della prossima attività.',
      tags: ['easy', budget === 'basso' ? 'low budget' : 'conviviale', people > 5 ? 'gruppi' : 'smart'],
    },
    {
      key: 'panoramic-walk',
      when: highEnergy >= Math.ceil(Math.max(moods.length, 1) / 2) && highWalking > 0 && weather !== 'pioggia',
      title: 'Passeggiata panoramica con tappa iconica',
      description: `Un percorso semplice per vedere il meglio di ${group.destination} e decidere poi la prossima tappa.`,
      reason: 'Il gruppo ha energia e voglia di camminare: è il momento giusto per un\'esperienza outdoor.',
      tags: ['panorama', 'outdoor', 'gruppi'],
    },
    {
      key: 'museum-culture',
      when: activity === 'cultura' || weather === 'pioggia',
      title: 'Museo o experience indoor',
      description: 'Un\'attività culturale coperta e facile da gestire anche con meteo incerto.',
      reason: weather === 'pioggia' ? 'Con la pioggia conviene tenersi su esperienze indoor.' : 'La preferenza del gruppo punta su cultura e ritmo tranquillo.',
      tags: ['indoor', 'cultura', people > 6 ? 'facile' : 'iconico'],
    },
    {
      key: 'relax-stop',
      when: lowEnergy >= Math.ceil(Math.max(moods.length, 1) / 2) || activity === 'relax',
      title: 'Relax spot con vista o lounge',
      description: 'Una pausa comoda per ricaricarsi, bere qualcosa e riallineare il gruppo.',
      reason: 'L\'energia è bassa o il gruppo preferisce un\'attività soft e con poco movimento.',
      tags: ['rilassante', 'poco movimento', budget === 'alto' ? 'premium' : 'easy'],
    },
    {
      key: 'shopping-central',
      when: activity === 'shopping' && weather !== 'pioggia',
      title: 'Shopping street o mercato locale',
      description: 'Un\'area centrale con più opzioni vicine, perfetta per muoversi in libertà senza disperdersi.',
      reason: 'Il gruppo vuole qualcosa di leggero, libero e facilmente modulabile.',
      tags: ['shopping', 'centrale', 'flessibile'],
    },
    {
      key: 'nightlife',
      when: (timeSlot === 'sera' || timeSlot === 'notte') && activity === 'nightlife',
      title: 'Cocktail bar o zona nightlife easy',
      description: 'Una zona viva ma semplice da raggiungere, ideale per stare insieme senza perdere tempo.',
      reason: 'È la fascia serale e il gruppo ha espresso voglia di socialità e nightlife.',
      tags: ['nightlife', 'gruppi', 'social'],
    },
    {
      key: 'family-easy',
      when: activity === 'family' || preference === 'kids friendly',
      title: 'Attività kids friendly e zero stress',
      description: 'Uno spazio facile da gestire per famiglie, con tempi flessibili e comfort.',
      reason: 'La priorità è mantenere il gruppo compatto e comodo anche con esigenze familiari.',
      tags: ['kids friendly', 'easy', 'relax'],
    },
  ];

  const preferredTag = preference !== 'nessuna' ? preference : null;
  const selected = basePool
    .filter((item) => item.when)
    .map((item, index) => ({
      id: `${item.key}-${Date.now()}-${index}`,
      title: item.title,
      description: item.description,
      reason: `${item.reason} ${preferredTag ? `La preferenza attuale è ${preferredTag}.` : ''}`.trim(),
      tags: preferredTag && !item.tags.includes(preferredTag) ? [...item.tags, preferredTag] : item.tags,
      timeSlot,
      createdAt: new Date().toISOString(),
      weather,
      preference,
    } satisfies Suggestion))
    .sort((a, b) => {
      const aPriority = Number(a.tags.includes('gruppi')) + Number(a.tags.includes('easy'));
      const bPriority = Number(b.tags.includes('gruppi')) + Number(b.tags.includes('easy'));
      return bPriority - aPriority;
    })
    .slice(0, 3);

  if (selected.length === 0) {
    return [
      {
        id: `fallback-${Date.now()}-1`,
        title: 'Zona centrale con opzioni flessibili',
        description: `Una base semplice a ${group.destination} per decidere insieme sul posto senza attriti.`,
        reason: 'Quando il gruppo è molto eterogeneo, conviene scegliere un punto comodo con alternative vicine.',
        tags: ['easy', 'gruppi', budget === 'basso' ? 'economico' : 'flessibile'],
        timeSlot,
        createdAt: new Date().toISOString(),
        weather,
        preference,
      },
    ];
  }

  return selected;
}
