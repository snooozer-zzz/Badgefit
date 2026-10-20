import { describe, expect, it } from 'vitest';
import { badges, categories, mountedList, options, uniforms } from '../data';
import { resolveMounted } from './art';
import type { Uniform } from '../data/schema';
import { libraryBadges, libraryCategories } from './library';
import { badgeKey, layoutBadges } from './placement';
import {
  branchOptions,
  branchWorn,
  describeSelection,
  dressOptions,
  EMPTY_SELECTION,
  filterOptions,
  itemsForRank,
  loadoutFor,
  missingField,
  parseSelection,
  rankOptions,
  sanitizeSelection,
  uniformFor,
  type Selection,
} from './selection';

const uniformById = (id: string) => uniforms.find((u) => u.id === id)!;
const keysOf = (list: { category: string; slug: string }[]) => list.map(badgeKey).sort();
const pick = (patch: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...patch });
const wear = (sel: Selection, uniformId: string) => loadoutFor(sel, uniformById(uniformId), badges, categories, options);

describe('uniform data', () => {
  it('has No. 1, No. 3 and No. 5 for every service and gender, one drawing each', () => {
    for (const dress of options.dresses) {
      for (const service of options.services) {
        for (const gender of options.genders) {
          const found = uniforms.filter((u) => u.dress === dress.id && u.services.includes(service.id) && u.genders.includes(gender.id));
          expect(found, `${dress.id} ${service.id} ${gender.id}`).toHaveLength(1);
        }
      }
    }
  });

  it('serves No. 1 to all three services and both genders with the single number-1 drawing', () => {
    const one = uniformById('number-1');
    expect(one.services).toEqual(['army', 'rsaf', 'rsn']);
    expect(one.genders).toEqual(['male', 'female']);
    expect(uniforms.filter((u) => u.dress === 'number-1')).toHaveLength(1);
  });

  it('gives No. 3 and No. 5 a drawing per service and gender, named after its file', () => {
    expect(uniforms).toHaveLength(13);
    for (const u of uniforms.filter((x) => x.dress !== 'number-1')) {
      expect(u.id).toBe(`${u.dress}-${u.services[0]}-${u.genders[0]}`);
      expect(u.image).toBe(`uniforms/${u.id}.png`);
      expect(u.anchors.every((a) => !a.verified)).toBe(true);
    }
  });

  it('draws the boards, sleeve insignia and sleeve badges of No. 3 and No. 5 from the number-1 perspective sprites', () => {
    const sprites = resolveMounted(mountedList, 'number-1', 'army')!;
    for (const u of uniforms.filter((x) => x.dress !== 'number-1')) {
      expect(u.mountedFrom, u.id).toBe('number-1');
      expect(resolveMounted(mountedList, u.mountedFrom ?? u.id, u.services[0]), u.id).toBe(sprites);
      const boxes = layoutBadges(u, wear(pick({ rank: '3SG' }), u.id).badges, categories, 1);
      for (const b of boxes) expect(sprites.items[badgeKey(b.badge)], `${u.id} ${badgeKey(b.badge)}`).toBeDefined();
    }
    expect(uniformById('number-1').mountedFrom).toBeUndefined();
  });

  it('has no collar badge spot on No. 3 and No. 5, only the rank and chest badges', () => {
    for (const u of uniforms.filter((x) => x.dress !== 'number-1')) {
      expect(branchWorn(u, options), u.id).toBe(false);
      expect(u.anchors.some((a) => a.accepts.includes('gorgets')), u.id).toBe(false);
      expect(u.anchors.some((a) => a.accepts.includes('shoulder-boards')), u.id).toBe(true);
      expect(u.anchors.some((a) => a.accepts.includes('rank-insignia')), u.id).toBe(true);
      expect(u.anchors.some((a) => a.accepts.includes('medals')), u.id).toBe(true);
    }
    expect(branchWorn(uniformById('number-1'), options)).toBe(true);
  });

  it('has no incentive-badge spot where the drawing has no pocket flap', () => {
    const hasSpot = (id: string) => uniformById(id).anchors.some((a) => a.accepts.includes('incentive'));
    expect(hasSpot('number-1')).toBe(true);
    expect(hasSpot('number-5-army-male')).toBe(true);
    expect(hasSpot('number-5-rsn-female')).toBe(false);
    expect(hasSpot('number-3-rsaf-male')).toBe(false);
  });

  it('moves the chest spots of No. 5 male with its lower pocket flaps and keeps the No. 1 distances', () => {
    const one = uniformById('number-1').anchors.find((a) => a.id === 'left-chest-medals')!;
    const five = uniformById('number-5-army-male').anchors.find((a) => a.id === 'left-chest-medals')!;
    expect(five.y - one.y).toBeCloseTo(12);
    const medal = badges.find((b) => b.category === 'medals')!;
    const top = (id: string) => layoutBadges(uniformById(id), [medal], categories, 1)[0].y;
    expect(top('number-5-army-male') - top('number-1')).toBeCloseTo(12);
  });

  it('draws the chest spots of a drawing without flaps where No. 1 has them', () => {
    const at = (id: string) => uniformById(id).anchors.find((a) => a.id === 'left-chest-medals')!;
    expect(at('number-3-army-male').x).toBe(at('number-1').x);
    expect(at('number-3-army-male').y).toBe(at('number-1').y);
  });
});

describe('filterOptions', () => {
  const ranks = rankOptions(badges, options);

  it('shows everything for an empty search', () => {
    expect(filterOptions(ranks, '')).toHaveLength(ranks.length);
    expect(filterOptions(ranks, '   ')).toHaveLength(ranks.length);
  });

  it('matches case-insensitively, anywhere in the name', () => {
    expect(filterOptions(ranks, 'lieutenant').map((o) => o.id)).toEqual(expect.arrayContaining(['2LT', 'LTA', 'LTC', 'SLTC', 'LTG']));
    expect(filterOptions(ranks, 'COLONEL').map((o) => o.id)).toContain('LTC');
    expect(filterOptions(ranks, 'ond lieu').map((o) => o.id)).toEqual(['2LT']);
  });

  it('finds a rank by its code', () => {
    expect(filterOptions(ranks, '2lt').map((o) => o.id)).toContain('2LT');
    expect(filterOptions(ranks, '2LT').map((o) => o.id)).toContain('2LT');
    expect(filterOptions(ranks, 'msg').map((o) => o.id)).toEqual(['MSG']);
  });

  it('gives nothing when nothing matches', () => {
    expect(filterOptions(ranks, 'zzz')).toEqual([]);
  });
});

describe('options', () => {
  it('lists ranks once each, the insignia ranks first and then the boards, the same for every service', () => {
    const ranks = rankOptions(badges, options);
    const ids = ranks.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(36);
    expect(ids.slice(0, 9)).toEqual(['PFC', 'LCP', 'CPL', 'CFC', '3SG', '2SG', '1SG', 'SSG', 'MSG']);
    expect(ids[9]).toBe('3WO');
    expect(ids.at(-1)).toBe('LTG');
    expect(ranks.find((r) => r.id === '2LT')?.label).toBe('2LT Second Lieutenant');
  });

  it('lists the arms badges as branches, for every service', () => {
    const slugs = branchOptions(badges, options).map((b) => b.id);
    expect(slugs).toHaveLength(12);
    expect(slugs).toContain('infantry');
  });

  it('enables every dress for a picked service and gender, and nothing before they are picked', () => {
    expect(dressOptions(options, uniforms, 'rsaf', 'female').every((o) => !o.disabled)).toBe(true);
    const none = dressOptions(options, uniforms, null, 'male');
    expect(none.every((o) => o.disabled)).toBe(true);
    expect(none[0].reason).toBe('Pick a service and gender first');
  });

  it('shows a dress with no drawing as disabled, "Not drawn yet"', () => {
    const maleOnly = uniforms.map((u): Uniform => (u.dress === 'number-1' ? { ...u, genders: ['male'] } : u));
    const options1 = dressOptions(options, maleOnly, 'army', 'female');
    expect(options1.find((o) => o.id === 'number-1')).toMatchObject({ disabled: true, reason: 'Not drawn yet' });
    expect(options1.find((o) => o.id === 'number-3')?.disabled).toBeUndefined();
  });
});

describe('uniformFor', () => {
  it('uses the one No. 1 drawing for any service and gender', () => {
    for (const service of ['army', 'rsaf', 'rsn']) for (const gender of ['male', 'female']) expect(uniformFor(uniforms, 'number-1', service, gender)?.id).toBe('number-1');
  });

  it('picks the drawing of the service and gender for No. 3 and No. 5', () => {
    expect(uniformFor(uniforms, 'number-3', 'rsn', 'female')?.id).toBe('number-3-rsn-female');
    expect(uniformFor(uniforms, 'number-5', 'rsaf', 'male')?.id).toBe('number-5-rsaf-male');
  });

  it('gives nothing until all three are picked', () => {
    expect(uniformFor(uniforms, null, 'army', 'male')).toBeNull();
    expect(uniformFor(uniforms, 'number-1', null, 'male')).toBeNull();
  });
});

describe('sanitizeSelection', () => {
  const full = pick({ service: 'army', gender: 'male', dress: 'number-3', rank: '2LT', branch: 'infantry' });

  it('keeps a valid selection as it is', () => {
    expect(sanitizeSelection(full, uniforms, badges, options)).toEqual(full);
  });

  it('keeps the uniform when another service still has the dress, and the rank and branch with it', () => {
    expect(sanitizeSelection({ ...full, service: 'rsn' }, uniforms, badges, options)).toEqual({ ...full, service: 'rsn' });
  });

  it('clears the uniform when the new gender or service has no drawing of it', () => {
    const maleOnly = uniforms.map((u): Uniform => (u.dress === 'number-1' ? { ...u, genders: ['male'] } : u));
    const sel = { ...full, dress: 'number-1' };
    expect(sanitizeSelection(sel, maleOnly, badges, options).dress).toBe('number-1');
    expect(sanitizeSelection({ ...sel, gender: 'female' }, maleOnly, badges, options)).toEqual({ ...sel, gender: 'female', dress: null });
    const armyOnly = uniforms.map((u): Uniform => (u.dress === 'number-1' ? { ...u, services: ['army'] } : u));
    expect(sanitizeSelection({ ...sel, service: 'rsaf' }, armyOnly, badges, options).dress).toBeNull();
  });

  it('clears a uniform picked before the service and gender, and values that do not exist', () => {
    expect(sanitizeSelection(pick({ dress: 'number-1' }), uniforms, badges, options).dress).toBeNull();
    const junk = sanitizeSelection(pick({ service: 'navy', gender: 'x', rank: 'KING', branch: 'wizards' }), uniforms, badges, options);
    expect(junk).toEqual(EMPTY_SELECTION);
  });
});

describe('missingField', () => {
  const one = uniformById('number-1');
  const three = uniformById('number-3-army-male');

  it('names the first field still to pick, in screen order', () => {
    expect(missingField(EMPTY_SELECTION, null, options)).toBe('Service');
    expect(missingField(pick({ service: 'army' }), null, options)).toBe('Gender');
    expect(missingField(pick({ service: 'army', gender: 'male' }), null, options)).toBe('Uniform');
    expect(missingField(pick({ service: 'army', gender: 'male', dress: 'number-1' }), one, options)).toBe('Rank');
    expect(missingField(pick({ service: 'army', gender: 'male', dress: 'number-1', rank: '2LT' }), one, options)).toBe('Branch');
  });

  it('is satisfied when every field is set', () => {
    expect(missingField(pick({ service: 'army', gender: 'male', dress: 'number-1', rank: '2LT', branch: 'infantry' }), one, options)).toBeNull();
  });

  it('does not ask for a branch on a uniform that has no collar badge', () => {
    expect(missingField(pick({ service: 'army', gender: 'male', dress: 'number-3', rank: '2LT' }), three, options)).toBeNull();
  });
});

describe('what a rank implies (from badges.json)', () => {
  it('gives an officer the board of that rank', () => {
    expect(keysOf(itemsForRank('2LT', badges, options))).toEqual(['shoulder-boards/2lt']);
  });

  it('gives a warrant officer and a military expert their own board', () => {
    expect(keysOf(itemsForRank('3WO', badges, options))).toEqual(['shoulder-boards/3wo']);
    expect(keysOf(itemsForRank('ME4A', badges, options))).toEqual(['shoulder-boards/me4-apprentice']);
  });

  it('gives specialists and enlistees the plain board and their rank insignia', () => {
    for (const rank of ['PFC', 'CFC', '3SG', 'MSG']) {
      expect(keysOf(itemsForRank(rank, badges, options)), rank).toEqual(['rank-insignia/' + rank.toLowerCase(), 'shoulder-boards/plain']);
    }
  });

  it('gives COL, BG and MG a gorget with their board, and LTG a board only (no LTG gorget in the data)', () => {
    for (const rank of ['COL', 'BG', 'MG']) {
      expect(keysOf(itemsForRank(rank, badges, options)), rank).toEqual(['gorgets/' + rank.toLowerCase(), 'shoulder-boards/' + rank.toLowerCase()]);
    }
    expect(keysOf(itemsForRank('LTG', badges, options))).toEqual(['shoulder-boards/ltg']);
  });

  it('gives every listed rank at least a board', () => {
    for (const r of rankOptions(badges, options)) {
      expect(itemsForRank(r.id, badges, options).some((b) => b.category === 'shoulder-boards'), r.id).toBe(true);
    }
  });
});

describe('loadoutFor', () => {
  it('wears the board and the branch badge on No. 1', () => {
    const l = wear(pick({ rank: '2LT', branch: 'infantry' }), 'number-1');
    expect(keysOf(l.badges)).toEqual(['arms/infantry', 'shoulder-boards/2lt']);
    expect(l.notes).toEqual([]);
  });

  it('wears the plain board, the rank insignia and the branch badge for a specialist', () => {
    const l = wear(pick({ rank: '3SG', branch: 'armour' }), 'number-1');
    expect(keysOf(l.badges)).toEqual(['arms/armour', 'rank-insignia/3sg', 'shoulder-boards/plain']);
  });

  it('wears the gorget instead of the branch badge for COL and above, and says so', () => {
    const l = wear(pick({ rank: 'COL', branch: 'infantry' }), 'number-1');
    expect(keysOf(l.badges)).toEqual(['gorgets/col', 'shoulder-boards/col']);
    expect(l.notes).toHaveLength(1);
    expect(l.notes[0]).toMatch(/gorget.*in place of.*Infantry/i);
  });

  it('wears no collar badge on No. 3 and No. 5, only the rank, and has nothing to say about the branch', () => {
    for (const id of ['number-3-army-male', 'number-5-rsaf-male', 'number-5-rsn-female']) {
      const l = wear(pick({ rank: '3SG', branch: 'infantry' }), id);
      expect(keysOf(l.badges), id).toEqual(['rank-insignia/3sg', 'shoulder-boards/plain']);
      expect(l.notes, id).toEqual([]);
    }
  });

  it('leaves a gorget off a uniform with no collar spot and explains it', () => {
    const l = wear(pick({ rank: 'COL' }), 'number-3-rsaf-male');
    expect(keysOf(l.badges)).toEqual(['shoulder-boards/col']);
    expect(l.notes).toHaveLength(1);
    expect(l.notes[0]).toMatch(/Colonel.*not shown on No\. 3 RSAF \(male\)/);
  });

  it('wears the same rank items for every service', () => {
    const keys = (service: string, id: string) => keysOf(wear(pick({ service, rank: '2SG', branch: 'signal' }), id).badges);
    expect(keys('army', 'number-1')).toEqual(keys('rsn', 'number-1'));
    expect(keys('army', 'number-5-army-male')).toEqual(keys('rsaf', 'number-5-rsaf-male'));
  });

  it('wears nothing for an empty selection', () => {
    expect(wear(EMPTY_SELECTION, 'number-1')).toEqual({ badges: [], notes: [] });
  });

  it('places everything on a spot of the uniform (the branch badge on both collars)', () => {
    const boxes = layoutBadges(uniformById('number-1'), wear(pick({ rank: '3SG', branch: 'armour' }), 'number-1').badges, categories, 1);
    expect(boxes.map((b) => b.anchor.id).sort()).toEqual(['right-collar', 'right-collar', 'right-sleeve-rank', 'shoulders']);
  });
});

describe('the library', () => {
  it('lists only badges and medals, not what the selection screen chooses', () => {
    const ids = libraryCategories(categories).map((c) => c.id);
    for (const gone of ['arms', 'shoulder-boards', 'rank-insignia', 'gorgets', 'formation']) expect(ids).not.toContain(gone);
    for (const kept of ['exceptional-skills', 'skills', 'skill-tabs', 'proficiency', 'incentive', 'identification', 'medals', 'foreign-badges', 'foreign-sleeve-tabs', 'foreign-sleeve-badges']) {
      expect(ids).toContain(kept);
    }
  });

  it('has no board, insignia, gorget, arms or formation badge in it', () => {
    const cats = new Set(libraryBadges(badges, categories).map((b) => b.category));
    expect(cats.has('medals')).toBe(true);
    for (const gone of ['arms', 'shoulder-boards', 'rank-insignia', 'gorgets', 'formation']) expect(cats.has(gone)).toBe(false);
  });
});

describe('saved selection', () => {
  it('reads back what was saved', () => {
    const sel = pick({ service: 'rsn', gender: 'female', dress: 'number-3', rank: 'MAJ', branch: 'signal' });
    expect(parseSelection(JSON.stringify(sel))).toEqual(sel);
  });

  it('starts empty when there is nothing, or the text is not a selection', () => {
    for (const raw of [null, '', 'not json', '42', 'null', '[1]']) expect(parseSelection(raw), String(raw)).toEqual(EMPTY_SELECTION);
    expect(parseSelection('{"service":5,"rank":"2LT"}')).toEqual(pick({ rank: '2LT' }));
  });
});

describe('describeSelection', () => {
  it('reads as one line for the top bar', () => {
    const sel = pick({ service: 'army', gender: 'male', dress: 'number-1', rank: '2LT', branch: 'infantry' });
    expect(describeSelection(sel, badges, options)).toBe('Army · Male · No. 1 · 2LT Second Lieutenant · Infantry');
  });
});
