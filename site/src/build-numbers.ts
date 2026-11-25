// Where the numbers come from: the starting point, your own measurements, and how it is all worked out.
import { DAMPENER_G, DENSITY, OVERGRIP_G, PUBLISHED_BED, TAPE_G_PER_INCH, WRAP_M } from '../../src/mass';
import { SHIFT } from '../../src/play';
import { bench, uid, type Desk } from './build-parts';
import { PLAY_LABEL, STOCK, cleanMeasure, provenance, yoursHint } from './build-view';
import { el } from './dom';
import { MATERIAL_LABEL } from './string-view';

function measureField(desk: Desk, key: 'g' | 'balanceMm', label: string, unit: string) {
  const id = uid('measure');
  const fault = el('p', { class: 'field-fault', id: `${id}-fault`, role: 'alert' });
  const input = el('input', { class: 'field', id, type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-describedby': `${id}-fault` });
  const apply = () => {
    const r = cleanMeasure(key, input.value);
    fault.textContent = 'error' in r ? r.error : '';
    input.setAttribute('aria-invalid', String('error' in r));
    if ('error' in r || r.value === desk.build.yours[key]) return;
    const yours = { ...desk.build.yours };
    if (r.value === undefined) delete yours[key];
    else yours[key] = r.value;
    desk.change({ yours });
  };
  const show = () => {
    input.value = desk.build.yours[key]?.toString() ?? '';
    fault.textContent = '';
    input.setAttribute('aria-invalid', 'false');
  };
  input.addEventListener('change', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') apply();
    if (e.key !== 'Escape') return;
    e.preventDefault(); // give the field up, not the page
    show();
    input.blur();
  });
  return {
    node: el('div', { class: 'measure-field' }, el('label', { class: 'field-label', for: id }, label), el('span', { class: 'field-unit' }, input, unit), fault),
    sync() {
      if (document.activeElement !== input) show();
    },
    reset: show,
  };
}

/** `reset`: another build is on the page, so a number half typed was for the last one. */
export function numbersBench(desk: Desk): { node: HTMLElement; sync(): void; reset(): void } {
  const from = el('p', { class: 'bench-note' });
  const fields = [measureField(desk, 'g', 'Weight, unstrung', 'g'), measureField(desk, 'balanceMm', 'Balance, unstrung', 'mm from the butt')];
  const hint = el('p', { class: 'bench-note' });
  const forget = el('button', { class: 'button', type: 'button' }, 'Use the published numbers');
  forget.addEventListener('click', () => {
    desk.change({ yours: {} }, 'Your own measurements removed.');
    yours.querySelector('summary')!.focus();
  });
  const yours = el('details', { class: 'fold' },
    el('summary', {}, 'Use my own measurements'),
    el('p', { class: 'bench-note' }, 'Weigh and balance your racquet without strings. Both are needed: a balance cannot be worked out from a weight alone.'),
    ...fields.map((f) => f.node), hint, forget);
  return {
    node: bench('Where the numbers come from', from, yours, howItWorks()),
    reset: () => fields.forEach((f) => f.reset()),
    sync() {
      const mine = desk.build.yours;
      from.textContent = provenance(desk.base.specs, mine);
      for (const f of fields) f.sync();
      hint.textContent = yoursHint(mine);
      forget.hidden = mine.g === undefined && mine.balanceMm === undefined;
    },
  };
}

/** Formulas and constants, read from the code that uses them. */
function howItWorks(): HTMLElement {
  const bed = PUBLISHED_BED;
  const row = (what: string, how: string) => el('div', { class: 'row' }, el('dt', {}, what), el('dd', {}, how));
  const per = (shifts: Partial<Record<string, number>>) => Object.entries(shifts).map(([k, v]) => `${PLAY_LABEL[k as keyof typeof PLAY_LABEL].toLowerCase()} ${v! > 0 ? '+' : '−'}${Math.abs(v!)}`).join(', ');
  return el('details', { class: 'fold' },
    el('summary', {}, 'How we work this out'),
    el('p', { class: 'bench-note' }, 'Weight, balance and swingweight are arithmetic: everything you add is a mass at its own place on the model. Changes are against this racquet with stock strings. Nothing here was weighed.'),
    el('dl', { class: 'rows' },
      row('A string', 'π/4 · gauge² · density · length, spread along its line'),
      row('Length', `its line on the model, and ${Math.round(WRAP_M * 1000)} mm for going round the frame (our guess)`),
      row('Density', `polyester ${DENSITY.polyester}, nylon ${DENSITY.multifilament}, natural gut ${DENSITY['natural-gut']} kg/m³ (gut is our guess)`),
      row('Stock strings', `taken as ${STOCK.gaugeMm} mm ${STOCK.material}`),
      row('Lead tape', `${TAPE_G_PER_INCH} g an inch of ¼ in tape, at the middle of the piece`),
      row('Overgrip', `${OVERGRIP_G} g, spread along the grip`),
      row('Dampener', `${DAMPENER_G} g, at the foot of the centre mains`),
      row('Balance', 'Σ mass · height ÷ Σ mass, from the butt'),
      row('Points', '(half the length − balance) ÷ 3.175 mm; head light when positive'),
      row('Swingweight', 'Σ mass · (height − 101.6 mm)², in kg·cm²'),
      row('Twist added', 'Σ mass · (distance from the long axis)², in kg·cm²'),
      row('Pitch', '√(tension ÷ mass per metre) ÷ 2 · length of the centre main'),
      row('“About”', `worked back from strung figures, less a plain bed of ${bed.gaugeMm} mm ${MATERIAL_LABEL[bed.material].toLowerCase()}`),
    ),
    el('p', { class: 'bench-note' }, `How it plays is our judgement, not a measurement: the racquet’s rating plus these, kept between 1 and 5. Mains count ${SHIFT.mains}, crosses ${SHIFT.crosses}.`),
    el('dl', { class: 'rows' },
      row('A string rating', `per point above ${SHIFT.rating.above}: ${per(SHIFT.rating.per)}`),
      row('Tension', `per ${SHIFT.tension.step} lb above ${SHIFT.tension.reference}, at most ${SHIFT.tension.limit} steps: ${per(SHIFT.tension.per)}`),
      row('Gauge', `per ${SHIFT.gauge.step} mm thinner than ${SHIFT.gauge.reference}: ${per(SHIFT.gauge.per)}`),
      row('Swingweight added', `per ${SHIFT.swingweight.step} kg·cm²: ${per(SHIFT.swingweight.per)}`),
      row('Twist added', `per ${SHIFT.twist.step} kg·cm²: ${per(SHIFT.twist.per)}`),
    ));
}
