// The tension bench: the mains and, if they differ, the crosses, in pounds or kilos, and the note they sound.
import { bench, segmented, slider, type Desk } from './build-parts';
import { tensionText, type TensionUnit } from './build-view';
import { el } from './dom';
import { play, soundOn } from './sound';

/** Milliseconds between the last touch of the slider and its pluck; one held still has settled too, later. */
const PLUCK_AFTER = 180;
const PLUCK_HELD = 540;
const UNIT_KEY = 'stringbed.tension-unit';

function storedUnit(): TensionUnit {
  try {
    return localStorage.getItem(UNIT_KEY) === 'kg' ? 'kg' : 'lb';
  } catch {
    return 'lb';
  }
}

/** `hz`: the bed's own note, when it can be worked out; `pluck` sounds it. */
export function tensionBench(desk: Desk, { hz, pluck }: { hz(): number | null; pluck(): void }): { node: HTMLElement; sync(): void } {
  let unit = storedUnit();
  /** One ratchet click a pound, and the pluck once it has settled. */
  const tension = (label: string, get: () => number, put: (lb: number) => void) => slider({
    label,
    min: 30,
    max: 75,
    step: 0.5,
    text: (lb) => tensionText(lb, unit),
    says: (lb) => (unit === 'lb' ? `${lb} pounds` : `${tensionText(lb, 'kg').replace(' kg', '')} kilograms`),
    input(lb) {
      const tooth = Math.floor(get());
      put(lb);
      if (Math.floor(lb) !== tooth) play('ratchet');
      desk.strum.soon(PLUCK_HELD);
    },
    settled: () => desk.strum.soon(PLUCK_AFTER),
  });
  const mains = tension('Tension', () => desk.build.tensionLb, (lb) => desk.change({ tensionLb: lb }));
  const crosses = tension('Crosses', () => desk.build.crossTensionLb ?? desk.build.tensionLb, (lb) => desk.change({ crossTensionLb: lb }));
  const units = segmented<TensionUnit>('Tension unit', [{ value: 'lb', text: 'lb' }, { value: 'kg', text: 'kg' }], (u) => {
    unit = u;
    try {
      localStorage.setItem(UNIT_KEY, u);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    sync();
  });
  const split = segmented('Cross tension', [{ value: 'same', text: 'Crosses the same' }, { value: 'own', text: 'Different' }], (v) => {
    if ((v === 'own') === (desk.build.crossTensionLb !== null)) return;
    desk.change({ crossTensionLb: v === 'own' ? desk.build.tensionLb : null }, v === 'own' ? 'Crosses have a tension of their own.' : 'Crosses at the same tension.');
  });
  const button = el('button', { class: 'button pluck', type: 'button' }, 'Pluck');
  button.addEventListener('click', pluck);
  const pitch = el('span', { class: 'pluck-note' });

  function sync() {
    const { tensionLb, crossTensionLb } = desk.build;
    units.set(unit);
    mains.set(tensionLb);
    mains.node.querySelector('.slider-label')!.textContent = crossTensionLb === null ? 'Mains and crosses' : 'Mains';
    crosses.node.hidden = crossTensionLb === null;
    crosses.set(crossTensionLb ?? tensionLb);
    split.set(crossTensionLb === null ? 'same' : 'own');
    const note = hz();
    button.disabled = note === null;
    pitch.textContent = note === null ? '' : `${Math.round(note)} Hz, the centre main’s own note${soundOn() ? '' : '. Sound is off'}`;
  }
  return { node: bench('Tension', el('div', { class: 'bench-aside' }, units.node), mains.node, split.node, crosses.node, el('div', { class: 'pluck-row' }, button, pitch)), sync };
}
