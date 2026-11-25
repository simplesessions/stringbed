// Editorial profiles (profiles/<brand>.json): a summary, what each frame is good for, and 1-5
// ratings. Loaded lazily, only when a racquet page opens; one file per brand, a few kilobytes.
export const RATING_KEYS = ['power', 'spin', 'control', 'comfort', 'stability', 'maneuverability', 'feel'] as const;
export type RatingKey = (typeof RATING_KEYS)[number];

export const RATING_LABEL: Record<RatingKey, string> = {
  power: 'Power',
  spin: 'Spin',
  control: 'Control',
  comfort: 'Comfort',
  stability: 'Stability',
  maneuverability: 'Manoeuvrability',
  feel: 'Feel',
};

export type Level = 'beginner' | 'intermediate' | 'advanced';
export const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];

export interface Profile {
  id: string;
  summary: string;
  bestFor: string[];
  playerLevel: Level[];
  playStyle: string;
  feel: string;
  ratings: Record<RatingKey, number>;
  compared: string[];
  variantNotes?: Record<string, string>;
  released?: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  researchedOn: string;
}

const files = import.meta.glob<Profile[]>('../../profiles/*.json', { import: 'default' });
let loaded: Promise<Map<string, Profile>> | null = null;

/** Every profile, once. A failed load rejects, and is forgotten so the next call tries again. */
export function loadProfiles(): Promise<Map<string, Profile>> {
  loaded ??= Promise.all(Object.values(files).map((load) => load()))
    .then((lists) => new Map(lists.flat().map((p) => [p.id, p] as const)))
    .catch((err) => {
      loaded = null;
      throw err;
    });
  return loaded;
}

/** "bestFor" tags read better as words: "net-play" becomes "Net play". */
export const tagLabel = (t: string): string => (t.charAt(0).toUpperCase() + t.slice(1)).replace(/-/g, ' ').replace('Maneuverability', 'Manoeuvrability');
