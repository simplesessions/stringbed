// Build my racquet: one racquet, what you put on it, and what that does. The build lives in the
// address (build-state.ts) and its changes in build-life.ts; the arithmetic and the words are in
// build-view.ts, when things happen in build-timing.ts, and each bench has its own file. This is the
// page that holds them together. main.ts lends it the stage and the places to go.
import { pitchHz } from '../../src/mass';
import type { Strand } from '../../src/restring';
import type { StringSpec } from '../../src/string-spec';
import type { PlacedTape, TapePiece } from '../../src/tape';
import type { Vector3 } from 'three';
import { doesSection } from './build-does';
import { leadBench } from './build-lead';
import { buildLife, carry } from './build-life';
import { numbersBench } from './build-numbers';
import { bench, swatches, type Desk, type Loading } from './build-parts';
import { readout } from './build-readout';
import { tapeTool, type TapeTool } from './build-stage';
import { COLOURS, formatBuild, type Build } from './build-state';
import { stringsBench } from './build-strings';
import { tensionBench } from './build-tension';
import { addressWriter, browserClock, dresser, lastWord, strummer, until } from './build-timing';
import { announcement, chosenStrings, droppedNotice, figures, finishSaid, hexOf, playInput, ratingsWord, sideEnd, strungOf, type Chosen, type Figures } from './build-view';
import { formatLength, inColourway, isJunior, type Racquet } from './catalog-view';
import { el, icon } from './dom';
import { loadProfiles, type Profile } from './profiles';
import { buildRoute, parseHash, routeFor } from './routes';
import { play, pluck } from './sound';
import { loadStrings } from './strings-data';
import type { Exhibit, Stage } from './strings-page';

type GL = typeof import('./gl');

/** What main.ts lends the page. */
export interface BuildHost {
  /** The 3D code; null when it did not load. It works the numbers out even where there is no WebGL. */
  gl(): GL | null;
  modelUrl(r: Racquet): string | null;
  present(change: () => void, inPlace?: boolean): void;
  showDetail(base: Racquet, title: string, nodes: () => Node[]): void;
  note(text: string): void;
  announce(text: string): void;
  /** `ready` is called for each model that arrives on the stage. */
  stage(r: Racquet, ready: () => void): Stage;
  exhibit(r: Racquet): Exhibit;
  family(r: Racquet): Racquet;
  /** `changed` is called whenever sound goes on or off in the header, until the signal. */
  onSound(changed: () => void, signal: AbortSignal): void;
  /** Ask which racquet, and go where it leads. */
  pickRacquet(leadsTo: (id: string) => string, chosen: (href: string) => void): void;
}
interface To {
  colourway: string | null;
  query: string;
}
export interface BuildPage {
  route(r: Racquet, to: To): void;
  /** The page is going: stop, and put the racquet's stock self back. */
  leave(): void;
}

interface Page {
  id: string;
  root: HTMLElement;
  nodes: Node[];
  /** The address changed under the page. */
  read(to: To): void;
  leave(): void;
}
type Carried = ReturnType<typeof carry>;

export function buildPage(host: BuildHost): BuildPage {
  let open: Page | null = null;
  /** A build on its way to another racquet, and what there is to say when it gets there. */
  let carried: Carried | null = null;
  return {
    route(r, to) {
      const word = carried?.query === to.query ? carried.notice : '';
      carried = null;
      if (open?.id === r.id && open.root.isConnected) return open.read(to);
      host.present(() => host.showDetail(r, `Build: ${r.brand} ${r.model}`, () => (open = onePage(host, r, to, word, (c) => (carried = c))).nodes));
    },
    leave() {
      open?.leave();
      open = null;
      carried = null;
    },
  };
}

/** Milliseconds between address writes, for a weave, and before a change is announced. */
const ADDRESS_GAP = 400;
const WEAVE_TAKES = 420;
const ANNOUNCE_AFTER = 700;

const strandOf = (c: Chosen): Strand => ({ color: c.colour.hex, finish: c.spec.finish, gaugeMm: c.choice.gaugeMm, sides: c.spec.shape?.sides ?? 0 });

/** `word`: what to say on arrival; `carry`: a build is off to another racquet. */
function onePage(host: BuildHost, base: Racquet, first: To, word: string, sendOff: (c: Carried) => void): Page {
  const gone = new AbortController();
  const { signal } = gone;
  const clock = until(signal, browserClock);
  const life = buildLife();
  const family = host.family(base);
  // A profile is about the family's adult frame, so a junior size inside the family goes without.
  const rated = !(isJunior(base) && !isJunior(family));
  let { colourway, shown } = inColourway(base, first.colourway);
  let arrived = '';
  let strings: StringSpec[] | null = null;
  let stringsState: Loading = 'loading';
  let profiles: Map<string, Profile> | null = null;
  let profilesState: Loading = 'loading';
  let model: Desk['model'] = null;
  let modelState: Loading | 'none' = 'loading';
  let now: Figures | null = null;
  let set: Desk['set'] = null;
  /** A piece of tape that is only being aimed. */
  let extra: TapePiece | null = null;

  // ---------- the address ----------

  const mine = () => {
    const r = parseHash(location.hash);
    return r.kind === 'build' && r.id === base.id; // Back may have moved on before the page has heard
  };
  const address = addressWriter(() => {
    if (mine()) history.replaceState(history.state, '', buildRoute(base.id, colourway, formatBuild(life.build)));
  }, ADDRESS_GAP, clock);
  // Anything that leaves by a link takes the finished address with it into the history.
  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest?.('a[href]')) address.flush();
  }, { capture: true, signal });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') address.flush();
  }, { capture: true, signal });
  window.addEventListener('pagehide', () => address.flush(), { signal });

  // ---------- change ----------

  let saying = '';
  const announcer = lastWord(() => {
    host.announce([saying, now && announcement(now)].filter(Boolean).join(' '));
    saying = '';
  }, clock);
  function announceSoon(what: string) {
    if (what) saying = what;
    announcer.soon(ANNOUNCE_AFTER);
  }
  function change(next: Partial<Build>, what = '') {
    if (!life.change(next)) return;
    address.touch();
    update();
    announceSoon(what);
  }

  const hz = () => model && pitchHz(model.beds, strungOf(set?.mains), life.build.tensionLb);
  function pluckNow() {
    const pitch = hz();
    if (pitch) pluck(pitch, { muted: life.build.dampener !== null });
  }
  const strum = strummer({ weave: () => play('weave'), pluck: pluckNow }, WEAVE_TAKES, clock);

  const laid = new Map<string, PlacedTape[]>();
  function lay(p: TapePiece): PlacedTape[] {
    const gl = host.gl();
    if (!model || !gl) return [];
    const key = [p.zone, p.at, p.mirrored, p.lengthMm, p.layers].join();
    let paths = laid.get(key);
    if (!paths) {
      if (laid.size > 500) laid.clear(); // a long drag asks for a place a frame
      paths = gl.placeTape(model.root, model.beds, p);
      laid.set(key, paths);
    }
    return paths;
  }

  const desk: Desk = {
    base,
    get build() { return life.build; },
    get strings() { return strings; },
    get stringsState() { return stringsState; },
    get set() { return set; },
    get model() { return model; },
    get figures() { return now; },
    lay,
    change,
    announce: host.announce,
    strum,
    clock,
  };

  // ---------- the stage ----------

  const stage = host.stage(shown, () => {
    if (modelState === 'failed') loadModel(); // the stage's own retry brought it
  });
  const { viewer } = stage;
  const dress = viewer && dresser(() => viewer.dress({
    strings: set && { mains: strandOf(set.mains), crosses: strandOf(set.crosses) },
    tape: extra ? [...life.build.tape, extra] : life.build.tape,
    overgrip: hexOf(life.build.overgrip),
    dampener: hexOf(life.build.dampener),
    balanceMm: now?.balance.value ?? null,
  }), clock);

  // Sticking tape on the model starts from the lead; while it is out, its way back is under the model too.
  const tapeButton = viewer ? el('button', { class: 'button', type: 'button' }, 'Add tape') : null;
  const tapeDone = el('button', { class: 'button tape-toggle', type: 'button', hidden: true }, 'Done');
  for (const b of [tapeButton, tapeDone]) b?.addEventListener('click', () => tool?.setMode(!tool.on));
  if (viewer) stage.node.querySelector('.stage-controls')?.prepend(tapeDone);

  // ---------- the benches ----------

  const readings = readout(desk, () => {
    loadModel();
    if (viewer) stage.update(host.exhibit(shown));
  });
  let headSeen = false;
  const stringBench = stringsBench(desk, {
    picked() {
      if (viewer && !tool?.on && !headSeen) viewer.focus('head');
      headSeen = true;
    },
    retry: fetchStrings,
  });
  const tension = tensionBench(desk, { hz, pluck: pluckNow });
  const lead = leadBench(desk, tapeButton, () => tool?.wake());
  const NONE = { id: '', name: 'None', hex: null };
  const nameOf = (id: string) => COLOURS.find((c) => c.id === id)!.name;
  const grip = swatches('Overgrip', [NONE, ...COLOURS], (id) => {
    change({ overgrip: id || null }, id ? `${nameOf(id)} overgrip.` : 'No overgrip.');
    play('wrap');
  }, true);
  const dampener = swatches('Dampener', [NONE, ...COLOURS], (id) => {
    change({ dampener: id || null }, id ? `${nameOf(id)} dampener.` : 'No dampener.');
    play('thump');
  }, true);
  const finish = bench('Grip and dampener', grip.node, dampener.node);
  const numbers = numbersBench(desk);
  const does = doesSection(fetchProfiles);

  let tool: TapeTool | null = null;
  const gl = host.gl();
  if (viewer && gl) {
    tool = tapeTool({
      viewer,
      stage: stage.node,
      tapeAt: (hit) => gl.tapeAt(model!.root, model!.beds, hit),
      model: () => model,
      tape: () => life.build.tape,
      lay,
      lengthIn: base.specs.lengthIn,
      aim(p) {
        extra = p;
        dress?.soon();
      },
      stick: lead.stick,
      move(i, place, done) {
        lead.put(i, place);
        if (done) play('press');
      },
      grabbed(i) {
        lead.open(i);
        play('peel');
      },
      selected: lead.opened,
      tapBed: pluckNow,
      onMode(on) {
        root.classList.toggle('is-taping', on);
        if (tapeButton) {
          tapeButton.disabled = on;
          tapeButton.textContent = on ? 'Adding tape' : 'Add tape';
        }
        const from = document.activeElement === tapeDone;
        tapeDone.hidden = !on;
        if (from && !on) (tapeButton?.checkVisibility() ? tapeButton : stage.node).focus({ preventScroll: true });
        // The racquet and its numbers grow for this on a phone: have both in view.
        const r = rig.getBoundingClientRect();
        if (on && r.bottom > innerHeight && r.top > 0) window.scrollBy({ top: r.top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        host.announce(on ? 'Adding tape. Arrow keys aim, Enter sticks, Escape is done.' : 'Tape put away.');
      },
      say: host.announce,
      clock,
      signal,
    });
  }

  // ---------- the page's own buttons ----------

  const back = el('a', { class: 'back' }, icon('back'), el('span', {}, base.model));
  const about = el('a', {}, 'Specs, write-up and stock 3D file');
  const swap = el('button', { class: 'text-button', type: 'button', 'aria-haspopup': 'dialog' }, 'Change racquet');
  swap.addEventListener('click', () => {
    address.flush();
    const c = carry(life.build, base.model);
    const stay = buildRoute(base.id, colourway, formatBuild(life.build));
    host.pickRacquet((id) => (id === base.id ? stay : buildRoute(id, null, c.query)), (href) => {
      if (href !== stay) sendOff(c);
    });
  });
  const copyField = el('input', { class: 'field copy-field', type: 'text', readonly: true, 'aria-label': 'The link to this build', hidden: true });
  const copy = el('button', { class: 'button is-main', type: 'button' }, 'Copy link');
  const copyAgain = lastWord(() => (copy.textContent = 'Copy link'), clock);
  copy.addEventListener('click', async () => {
    address.flush();
    const url = new URL(buildRoute(base.id, colourway, formatBuild(life.build)), location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      play('stamp');
      copy.textContent = 'Copied';
      copyAgain.soon(1800);
      host.announce('Link copied.');
    } catch {
      copyField.hidden = false; // no clipboard here: the link itself, ready to copy
      copyField.value = url;
      copyField.focus();
      copyField.select();
    }
  });
  const over = el('button', { class: 'text-button', type: 'button', hidden: true });
  over.addEventListener('click', () => {
    const did = life.startOver();
    if (!did) return;
    address.touch();
    update();
    announceSoon(did === 'back' ? 'Your build is back.' : 'Build cleared.');
    play(did === 'back' ? 'press' : 'peel');
  });
  host.onSound(tension.sync, signal);
  const nav = el('nav', { class: 'detail-nav build-nav', 'aria-label': 'Build' }, back, copy, copyField);

  const title = el('div', { class: 'build-title' },
    el('h1', { class: 'sheet-title', tabindex: '-1' }, `Build my ${base.model}`),
    el('p', { class: 'sheet-sub' }, `${base.brand} · ${formatLength(base.specs.lengthIn).primary} · ${base.specs.headSizeSqIn} in²`),
    el('div', { class: 'build-actions' }, swap, over),
    readings.small);
  const rig = el('div', { class: 'build-rig' }, stage.node, readings.node);
  const root = el('div', { class: 'build' }, rig,
    el('div', { class: 'build-bench' }, title, stringBench.node, tension.node, lead.node, finish.node, numbers.node, el('p', { class: 'build-more' }, about)),
    does.node);

  // The estimate sticks beside the bench; taller than the window, it sticks by its foot.
  const tall = new ResizeObserver(() => does.node.style.setProperty('--tall', `${does.node.offsetHeight}px`));
  tall.observe(does.node);
  signal.addEventListener('abort', () => tall.disconnect());

  // ---------- drawing ----------

  /** Everything on the page from the build: no sound, no words, no address. */
  function update() {
    if (life.left) return;
    const { build } = life;
    set = chosenStrings(build, strings);
    now = model && figures(base.specs, model.beds, build, set, build.tape.flatMap(lay));
    const ratings = rated ? profiles?.get(family.id)?.ratings ?? null : null;
    const [m, c] = base.specs.stringPattern;
    const { rows, sentences } = playInput({ name: base.model, ratings, pattern: [m, c], junior: isJunior(base) }, build, set, now ? { swingweight: now.swingweight.change, twist: now.twist } : { swingweight: 0, twist: 0 });
    readings.sync(modelState, rows);
    stringBench.sync();
    tension.sync();
    lead.sync();
    grip.set(build.overgrip ?? '');
    dampener.set(build.dampener ?? '');
    finish.say(finishSaid(build));
    numbers.sync();
    does.sync(rows, sentences, ratingsWord({
      version: family.variants?.length ? family.variantLabel ?? family.model : null,
      own: base.id === family.id,
      state: rated ? profilesState : 'ready',
      has: ratings !== null,
      stock: set === null && stringsState !== 'loading',
    }), profilesState !== 'loading');
    over.textContent = life.canPutBack ? 'Put it back' : 'Start over';
    over.hidden = !life.canPutBack && formatBuild(build) === '';
    tool?.wake();
    dress?.soon();
  }

  // ---------- what it loads ----------

  function loadModel() {
    const gl = host.gl();
    const url = host.modelUrl(shown);
    model = null;
    laid.clear();
    modelState = gl && url ? 'loading' : 'none';
    update();
    if (!gl || !url) return;
    const wanted = shown;
    const late = () => wanted !== shown || life.left;
    gl.loadModel(url).then(
      (root) => {
        if (late()) return;
        const beds = gl.bedLines(root);
        model = beds && { root, beds, sideEndMm: sideEnd((mm) => gl.tapeAt(root, beds, { x: 1, y: mm / 1000, z: 0 } as Vector3).zone) };
        modelState = model ? 'ready' : 'none';
        update();
      },
      () => {
        if (late()) return;
        modelState = 'failed';
        update();
      },
    );
  }

  const note = () => host.note([arrived, droppedNotice(life.dropped)].filter(Boolean).join(' '));
  function fetchStrings() {
    stringsState = 'loading';
    update();
    loadStrings().then(
      (c) => {
        if (life.left) return;
        strings = c.strings;
        stringsState = 'ready';
        life.check(c.strings);
        note();
        update();
      },
      () => {
        stringsState = 'failed';
        update();
      },
    );
  }
  function fetchProfiles() {
    profilesState = 'loading';
    update();
    loadProfiles().then(
      (p) => {
        if (life.left) return;
        profiles = p;
        profilesState = 'ready';
        update();
      },
      () => {
        profilesState = 'failed';
        update();
      },
    );
  }

  function read(to: To, word = '') {
    if (life.left) return;
    // First: what is held on the model is a piece of the build that is going, and it must not be put back into the new one.
    tool?.forget();
    address.cancel();
    strum.cancel();
    announcer.cancel();
    const next = inColourway(base, to.colourway);
    const repaint = next.colourway !== colourway;
    ({ colourway, shown } = next);
    life.read(to.query);
    numbers.reset();
    stringBench.close();
    arrived = word;
    note();
    back.href = about.href = routeFor(base.id, colourway);
    root.style.setProperty('--swatch', shown.swatch);
    if (repaint) {
      stage.update(host.exhibit(shown));
      loadModel();
    } else update();
  }

  read(first, word);
  loadModel();
  fetchStrings();
  fetchProfiles();

  return {
    id: base.id,
    root,
    nodes: [nav, root],
    read: (to) => read(to),
    leave() {
      life.leave();
      gone.abort();
      viewer?.dress(null);
    },
  };
}
