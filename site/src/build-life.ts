// The life of a build on its page: read from an address, checked once the strings are here, changed,
// cleared and put back, carried to another racquet, left. No DOM, and no sound, words or address.
import type { StringSpec } from '../../src/string-spec';
import { emptyBuild, formatBuild, parseBuild, type Build } from './build-state';

export interface BuildLife {
  readonly build: Build;
  /** What the address asked for and could not have. */
  readonly dropped: string[];
  /** Start over would put back what it cleared. */
  readonly canPutBack: boolean;
  readonly left: boolean;
  /** Another address: everything starts again from it. */
  read(query: string): void;
  /** The strings have arrived: hold the choices up against them. */
  check(strings: StringSpec[]): void;
  /** A visitor changed something. False once the page is left: a field that loses focus on the way out still says it changed. */
  change(next: Partial<Build>): boolean;
  /** Clear it, or put back what was cleared. */
  startOver(): 'cleared' | 'back' | null;
  leave(): void;
}

export function buildLife(): BuildLife {
  let build = emptyBuild();
  let dropped: string[] = [];
  let strings: StringSpec[] | null = null;
  /** The address as it came, until something is changed here. */
  let query: string | null = null;
  /** What Start over cleared, until something else changes. */
  let cleared: Build | null = null;
  let left = false;

  const change = (next: Partial<Build>): boolean => {
    if (left) return false;
    build = { ...build, ...next };
    query = null;
    cleared = null;
    return true;
  };
  return {
    get build() {
      return build;
    },
    get dropped() {
      return dropped;
    },
    get canPutBack() {
      return cleared !== null;
    },
    get left() {
      return left;
    },
    read(text) {
      if (left) return;
      query = text;
      ({ build, dropped } = parseBuild(text, strings));
      cleared = null;
    },
    check(all) {
      if (left) return;
      strings = all;
      // Against the address as it came, in its own words; or, once something has changed, as the build stands.
      const checked = parseBuild(query ?? formatBuild(build), all);
      build = checked.build;
      dropped = query === null ? [...dropped, ...checked.dropped] : checked.dropped;
    },
    change,
    startOver() {
      const before = build;
      const undo = cleared;
      if (!change(undo ?? emptyBuild())) return null;
      cleared = undo ? null : before;
      return undo ? 'back' : 'cleared';
    },
    leave() {
      left = true;
    },
  };
}

/** A build taken to another racquet: everything on it goes along, but what you measured was the old one. */
export function carry(build: Build, from: string): { query: string; notice: string } {
  const measured = build.yours.g !== undefined || build.yours.balanceMm !== undefined;
  return { query: formatBuild({ ...build, yours: {} }), notice: measured ? `Your measurements were for the ${from}, so they were cleared.` : '' };
}
