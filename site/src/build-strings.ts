// The strings bench: mains, and crosses the same or their own, from the string list.
import type { StringMaterial } from '../../src/string-spec';
import { chooseString, type StringChoice } from './build-state';
import { bench, fullName, sectionDot, segmented, swatches, uid, type Desk, type Segmented } from './build-parts';
import { stringList, stringsSaid, type Chosen } from './build-view';
import { crossSection } from './cross-section';
import { el, icon } from './dom';
import { stringRoute } from './routes';
import { play } from './sound';
import { MATERIALS, MATERIAL_LABEL, sectionNote, gaugeText } from './string-view';

type Which = 'mains' | 'crosses';

/** `picked`: a visitor put a string in where there were stock ones. `retry`: fetch the list again. */
export function stringsBench(desk: Desk, on: { picked(): void; retry(): void }): { node: HTMLElement; sync(): void; close(): void } {
  const again = el('button', { class: 'button', type: 'button' }, icon('retry'), 'Try again');
  again.addEventListener('click', on.retry);
  const fault = el('div', { class: 'bench-fault', hidden: true }, el('p', {}, 'The string list did not load, so this shows stock strings. Your link keeps its strings.'), again);
  const wait = el('p', { class: 'bench-note', hidden: true }, 'Loading strings…');

  function pick(which: Which, choice: StringChoice | null, name: string) {
    const before = desk.build.mains;
    desk.change(which === 'mains' ? { mains: choice, crosses: choice ? desk.build.crosses : null } : { crosses: choice }, `${which === 'mains' ? 'Mains' : 'Crosses'}: ${name}.`);
    if (!before && choice) on.picked();
    desk.strum.restrung();
  }

  const mains = stringSet(desk, 'mains', pick);
  const crosses = stringSet(desk, 'crosses', pick);
  const hybrid = segmented('Cross strings', [{ value: 'same', text: 'Same as mains' }, { value: 'own', text: 'Different' }], (v) => {
    if ((v === 'own') === (desk.build.crosses !== null) || !desk.set) return;
    desk.change({ crosses: v === 'own' ? { ...desk.build.mains! } : null }, v === 'own' ? 'Crosses chosen on their own.' : 'Crosses the same as the mains.');
    if (v === 'own') crosses.open(false);
    else desk.strum.restrung();
  });
  const crossesBlock = el('div', { class: 'set-crosses' }, el('h3', { class: 'bench-sub' }, 'Crosses'), hybrid.node, crosses.node);

  const section = bench('Strings', fault, wait, mains.node, crossesBlock);
  section.node.open = true; // where a build starts
  return {
    node: section.node,
    sync() {
      section.say(desk.stringsState === 'ready' ? stringsSaid(desk.set) : '');
      fault.hidden = desk.stringsState !== 'failed';
      wait.hidden = desk.stringsState !== 'loading';
      crossesBlock.hidden = !desk.set;
      hybrid.set(desk.build.crosses ? 'own' : 'same');
      mains.sync();
      crosses.sync();
    },
    close() {
      mains.close();
      crosses.close();
    },
  };
}

/** One of the two sets of strings: what is in, its colour, gauge and section, and the list to change it from. */
function stringSet(desk: Desk, which: Which, choose: (which: Which, choice: StringChoice | null, name: string) => void) {
  const label = which === 'mains' ? 'Mains' : 'Crosses';
  const inIt = () => desk.build[which];
  const inUse = () => inIt()?.id ?? null;
  const dot = el('span', { class: 'set-dot' });
  const name = el('span', { class: 'set-name' });
  const meta = el('span', { class: 'set-meta' });
  const options = el('div', { class: 'set-options' });
  const picker = el('div', { class: 'picker', id: uid('picker'), hidden: true });
  const toggle = el('button', { class: 'button set-change', type: 'button', 'aria-expanded': 'false', 'aria-controls': picker.id });
  const node = el('div', { class: 'set' },
    which === 'mains' ? el('h3', { class: 'bench-sub' }, 'Mains') : null,
    el('div', { class: 'set-row' }, dot, el('div', { class: 'set-text' }, name, meta), toggle), picker, options);

  // The list. Radios: an arrow key walks it and restrings as it goes.
  let material: StringMaterial | null = null;
  const group = uid('strings');
  const find = el('input', { class: 'field', type: 'search', placeholder: 'Find a string', 'aria-label': `Find a string for the ${label.toLowerCase()}`, autocomplete: 'off', spellcheck: 'false' });
  const kinds = segmented<string>('Material', [{ value: '', text: 'All' }, ...MATERIALS.map((m) => ({ value: m as string, text: MATERIAL_LABEL[m] }))], (m) => {
    material = (m || null) as StringMaterial | null;
    fill();
  });
  const list = el('div', { class: 'picker-list', role: 'radiogroup', 'aria-label': `${label} string` });
  const count = el('p', { class: 'picker-count', 'aria-live': 'polite' });
  const done = el('button', { class: 'button', type: 'button' }, 'Done');
  picker.append(el('div', { class: 'picker-top' }, find, done), kinds.node, count, list);
  find.addEventListener('input', fill);
  done.addEventListener('click', () => open(true));
  toggle.addEventListener('click', () => open(true));
  picker.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); // close the list, not the page
    open(true);
  });

  function row(id: string | null, art: Node, title: string, sub: string) {
    const input = el('input', { class: 'sr-only', type: 'radio', name: group, value: id ?? '' });
    input.checked = inUse() === id;
    input.addEventListener('change', () => {
      const spec = desk.strings?.find((s) => s.id === id);
      choose(which, spec ? chooseString(spec) : null, title);
    });
    return el('label', { class: 'pick' }, input, art, el('span', { class: 'pick-text' }, el('span', { class: 'pick-name' }, title), el('span', { class: 'pick-meta' }, sub)));
  }
  function fill() {
    if (!desk.strings) return;
    kinds.set(material ?? '');
    const rows = stringList(desk.strings, material, find.value, inUse())
      .map((s) => row(s.id, sectionDot(s, s.colours[0].hex), fullName(s), [MATERIAL_LABEL[s.material], s.shape?.label].filter(Boolean).join(' · ')));
    list.replaceChildren(...(which === 'mains' ? [row(null, el('span', { class: 'section-dot is-stock', 'aria-hidden': 'true' }), 'Stock strings', 'As it comes. Not rated.')] : []), ...rows);
    count.textContent = rows.length ? `${rows.length} ${rows.length === 1 ? 'string' : 'strings'}` : 'No string matches.';
  }
  /** Open or close the list. */
  function open(focus: boolean) {
    const opening = picker.hidden;
    picker.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    sync();
    if (opening) {
      fill();
      const at = list.querySelector<HTMLInputElement>('input:checked');
      if (at) list.scrollTop = at.closest<HTMLElement>('.pick')!.offsetTop - list.offsetTop - 60;
      if (focus) (matchMedia('(pointer: coarse)').matches ? at ?? find : find).focus({ preventScroll: true });
      picker.scrollIntoView({ block: 'nearest' });
    } else if (focus) toggle.focus({ preventScroll: true });
  }

  // Colour, gauge and section are rebuilt only when the string changes, so focus and arrows hold.
  let drawn: string | null = null;
  let parts: { colours: ReturnType<typeof swatches>; gauges: Segmented<number>; cut: HTMLElement } | null = null;
  function drawOptions(c: Chosen | null) {
    if (drawn === (c?.spec.id ?? null)) return;
    drawn = c?.spec.id ?? null;
    parts = null;
    options.replaceChildren();
    if (!c) return;
    const pick = (patch: Partial<StringChoice>) => desk.change({ [which]: { ...inIt()!, ...patch } });
    const colours = swatches(`${label} colour`, c.spec.colours, (id) => {
      pick({ colour: id });
      play('pick');
    });
    const gauges = segmented<number>(`${label} gauge, millimetres and number`, c.spec.gaugesMm.map((g) => ({ value: g, text: gaugeText(c.spec, g) })), (g) => {
      if (inIt()?.gaugeMm === g) return;
      pick({ gaugeMm: g });
      desk.strum.restrung();
    });
    const cut = el('div', { class: 'set-cut' });
    parts = { colours, gauges, cut };
    options.append(cut, el('div', { class: 'set-fields' },
      colours.node,
      el('div', { class: 'field-row' }, el('span', { class: 'field-label', 'aria-hidden': 'true' }, 'Gauge, mm'), gauges.node),
      c.spec.verified ? null : el('p', { class: 'bench-note' }, 'Colours approximate: not checked against a photo.')));
  }

  function sync() {
    const c = desk.set && (which === 'mains' ? desk.set.mains : desk.build.crosses ? desk.set.crosses : null);
    node.hidden = desk.stringsState !== 'ready' || (which === 'crosses' && !desk.build.crosses);
    if (which === 'crosses' && !desk.build.crosses) picker.hidden = true;
    toggle.setAttribute('aria-expanded', String(!picker.hidden));
    toggle.hidden = !picker.hidden; // the list has its own Done
    toggle.textContent = c ? 'Change' : 'Choose strings';
    toggle.setAttribute('aria-label', `${toggle.textContent}: ${label.toLowerCase()}`);
    dot.replaceChildren(c ? sectionDot(c.spec, c.colour.hex) : el('span', { class: 'section-dot is-stock' }));
    name.replaceChildren(c ? el('a', { href: stringRoute(c.spec.id, c.colour.id === c.spec.colours[0].id ? null : c.colour.id) }, fullName(c.spec)) : 'Stock strings');
    meta.textContent = c ? [MATERIAL_LABEL[c.spec.material], sectionNote(c.spec.shape)].join(' · ') : 'As it comes. Not rated, and weighed as 1.25 mm polyester.';
    drawOptions(c);
    if (c && parts) {
      parts.colours.set(c.colour.id);
      parts.gauges.set(c.choice.gaugeMm);
      parts.cut.style.setProperty('--swatch', c.colour.hex);
      const drawing = `${c.spec.id} ${c.choice.gaugeMm}`;
      if (parts.cut.dataset.of !== drawing) {
        parts.cut.dataset.of = drawing;
        parts.cut.replaceChildren(crossSection(c.spec.shape, c.choice.gaugeMm));
      }
    }
    for (const input of list.querySelectorAll('input')) input.checked = input.value === (inUse() ?? '');
  }
  return { node, sync, open, close: () => void (picker.hidden = true) };
}
