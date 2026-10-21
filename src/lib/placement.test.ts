// Tests for the placement rules (placement.ts), the layout of badges on a uniform (layout.ts) and ribbons (ribbon.ts).
import { describe, expect, it } from 'vitest';
import { badges, categories, mountedList, uniforms } from '../data';
import type { Badge, Uniform } from '../data/schema';
import { layoutBadges } from './layout';
import { badgeKey, canPlace, placeBadge } from './placement';
import { ART_PX, ribbonCrop, ribbonSpec } from './ribbon';

// The Number 1 uniform most tests use, and a lookup for a real badge by category and slug.
const uniform = uniforms.find((u) => u.id === 'number-1')!;
const get = (category: string, slug: string) => {
  const b = badges.find((x) => x.category === category && x.slug === slug);
  if (!b) throw new Error(`missing badge ${category}/${slug}`);
  return b;
};

describe('canPlace', () => {
  it('places a proficiency badge on the left shoulder sleeve', () => {
    const r = canPlace(uniform, get('proficiency', 'ippt-gold'), [], categories);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.anchor.id).toBe('left-shoulder-sleeve');
  });

  it('allows at most two proficiency badges', () => {
    const placed = [get('proficiency', 'ippt-gold'), get('proficiency', 'marksmanship')];
    const r = canPlace(uniform, get('proficiency', 'ippt-silver'), placed, categories);
    expect(r.ok).toBe(false);
  });

  it('rejects duplicates', () => {
    const b = get('proficiency', 'ippt-gold');
    expect(canPlace(uniform, b, [b], categories).ok).toBe(false);
  });

  it('rejects formation badges because the source gives no placement', () => {
    const r = canPlace(uniform, get('formation', '3-div'), [], categories);
    expect(r.ok).toBe(false);
  });
});

describe('layoutBadges', () => {
  it('puts exceptional skills badges before skills badges on the same spot', () => {
    const skills = get('skills', 'basic-parachutist');
    const exceptional = get('exceptional-skills', 'master-parachutist');
    const boxes = layoutBadges(uniform, [skills, exceptional], categories, 1);
    expect(boxes.map((b) => badgeKey(b.badge))).toEqual([badgeKey(exceptional), badgeKey(skills)]);
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
  });

  it('stacks two proficiency badges vertically around the anchor', () => {
    const boxes = layoutBadges(
      uniform,
      [get('proficiency', 'ippt-gold'), get('proficiency', 'marksmanship')],
      categories,
      1,
    );
    expect(boxes).toHaveLength(2);
    expect(boxes[0].y).toBeLessThan(boxes[1].y);
  });
});

describe('rank items', () => {
  it('puts shoulder boards on the shoulders and rank insignia on the right sleeve', () => {
    const board = canPlace(uniform, get('shoulder-boards', '2lt'), [], categories);
    const sleeve = canPlace(uniform, get('rank-insignia', '3sg'), [], categories);
    expect(board.ok && board.anchor.id).toBe('shoulders');
    expect(sleeve.ok && sleeve.anchor.id).toBe('right-sleeve-rank');
  });

  it('swaps the shoulder board when another rank is picked', () => {
    const first = get('shoulder-boards', '2lt');
    const r = placeBadge(uniform, get('shoulder-boards', 'cpt'), [first], categories);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.placed.map(badgeKey)).toEqual(['shoulder-boards/cpt']);
      expect(r.replaced).toBe(first);
    }
  });

  it('still refuses a third proficiency badge instead of swapping', () => {
    const placed = [get('proficiency', 'ippt-gold'), get('proficiency', 'marksmanship')];
    expect(placeBadge(uniform, get('proficiency', 'ippt-silver'), placed, categories).ok).toBe(false);
  });
});

describe('perspective sprites', () => {
  const mounted = mountedList.find((m) => m.uniform === uniform.id);

  it('exist for every shoulder board, rank insignia and gorget', () => {
    const rankItems = badges.filter((b) => ['shoulder-boards', 'rank-insignia', 'gorgets'].includes(b.category));
    expect(rankItems.length).toBeGreaterThan(30);
    for (const b of rankItems) expect(mounted?.items[badgeKey(b)], badgeKey(b)).toBeDefined();
  });

  it('draws both shoulder boards and both gorgets', () => {
    expect(mounted?.items['shoulder-boards/2lt'][0]).toHaveLength(2);
    expect(mounted?.items['gorgets/col'][0]).toHaveLength(2);
  });

  it('gives the second proficiency badge its own, lower slot', () => {
    const [s0, s1] = mounted!.items['proficiency/marksmanship'];
    expect(s1[0].y).toBeGreaterThan(s0[0].y);
  });

  it('numbers badges sharing a spot', () => {
    const boxes = layoutBadges(uniform, [get('proficiency', 'ippt-gold'), get('proficiency', 'marksmanship')], categories, 1);
    expect(boxes.map((b) => b.slot)).toEqual([0, 1]);
  });
});

// Rules from the SAF No.1 Dress guideline (March 2024), Army No.1 section.
// Foreign badges are not in the catalogue yet, so these tests use made-up badges.
/** Makes a badge for a test. */
const makeBadge = (category: string, slug: string, extra: Partial<Badge> = {}): Badge => ({
  slug,
  name: slug,
  category,
  status: 'todo',
  widthMm: 30,
  sizeVerified: false,
  ...extra,
});

describe('arms badge on both collars', () => {
  const armsBadge = get('arms', 'infantry');
  const [right, left] = layoutBadges(uniform, [armsBadge], categories, 1);

  it('is drawn twice, once per collar, either one removes the badge', () => {
    expect([right.side, left.side]).toEqual([0, 1]);
    expect(badgeKey(left.badge)).toBe(badgeKey(right.badge));
  });

  it('puts the copies either side of the front edge of the collar (x = 367.5), mirrored', () => {
    const centre = (b: typeof right) => b.x + b.width / 2;
    expect(centre(right)).toBeLessThan(367.5);
    expect(centre(left)).toBeGreaterThan(367.5);
    expect(367.5 - centre(right)).toBeCloseTo(centre(left) - 367.5);
    expect(left.y).toBeCloseTo(right.y);
  });

  it('tilts each one to follow the slanted collar, in opposite directions', () => {
    expect(right.rotation).toBeGreaterThan(0);
    expect(left.rotation).toBe(-right.rotation);
  });

  it('leaves other badges upright and single', () => {
    const boxes = layoutBadges(uniform, [get('skills', 'basic-parachutist')], categories, 1);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].rotation).toBe(0);
  });
});

describe('SAF No.1 Dress rules', () => {
  it('allows at most 3 SAF badges on the left chest, counting both skills categories together', () => {
    const three = [
      get('exceptional-skills', 'master-parachutist'),
      get('skills', 'basic-parachutist'),
      get('skills', 'combat-skills'),
    ];
    expect(canPlace(uniform, get('skills', 'rigger'), three.slice(0, 2), categories).ok).toBe(true);
    expect(canPlace(uniform, get('skills', 'rigger'), three, categories).ok).toBe(false);
  });

  it('allows at most 2 tabs on the left sleeve', () => {
    const placed = [get('skill-tabs', 'guards-tab'), get('skill-tabs', 'ranger-tab')];
    expect(canPlace(uniform, get('skill-tabs', 'reconnaissance-recon-tab'), placed, categories).ok).toBe(false);
  });

  it('wears the tabs higher on the sleeve than the sleeve badges', () => {
    const tabs = uniform.anchors.find((a) => a.id === 'left-sleeve-tabs');
    const badgeSpot = uniform.anchors.find((a) => a.id === 'left-shoulder-sleeve');
    expect(tabs!.y).toBeLessThan(badgeSpot!.y);
  });

  it('wears the marksmanship badge below the IPPT badge, whichever was picked first', () => {
    const marksmanship = get('proficiency', 'marksmanship');
    for (const ippt of [get('proficiency', 'ippt-gold'), get('proficiency', 'ippt-silver')]) {
      for (const picked of [[ippt, marksmanship], [marksmanship, ippt]]) {
        const boxes = layoutBadges(uniform, picked, categories, 1);
        expect(boxes.map((b) => badgeKey(b.badge))).toEqual([badgeKey(ippt), badgeKey(marksmanship)]);
      }
    }
  });

  it('wears either IPPT gold or IPPT silver, never both', () => {
    const gold = get('proficiency', 'ippt-gold');
    const silver = get('proficiency', 'ippt-silver');
    expect(canPlace(uniform, silver, [gold], categories).ok).toBe(false);
    expect(canPlace(uniform, gold, [silver], categories).ok).toBe(false);
    expect(canPlace(uniform, silver, [get('proficiency', 'marksmanship')], categories).ok).toBe(true);
  });

  it('wears only one marksmanship badge', () => {
    const sniper = makeBadge('proficiency', 'sniper-marksmanship', { exclusiveGroup: 'marksmanship' });
    const r = canPlace(uniform, sniper, [get('proficiency', 'marksmanship')], categories);
    expect(r.ok).toBe(false);
  });

  it('lets a Fitness Specialist badge replace the other marksmanship badges, not sit with them', () => {
    const fitness = makeBadge('proficiency', 'fitness-specialist', { exclusiveGroup: 'marksmanship' });
    expect(canPlace(uniform, fitness, [get('proficiency', 'ippt-gold')], categories).ok).toBe(true);
    expect(canPlace(uniform, fitness, [get('proficiency', 'marksmanship')], categories).ok).toBe(false);
  });

  it('allows at most 2 foreign tabs and 2 foreign badges on the right sleeve', () => {
    for (const category of ['foreign-sleeve-tabs', 'foreign-sleeve-badges']) {
      const placed = [makeBadge(category, 'a'), makeBadge(category, 'b')];
      expect(canPlace(uniform, makeBadge(category, 'a'), [placed[1]], categories).ok).toBe(true);
      expect(canPlace(uniform, makeBadge(category, 'c'), placed, categories).ok).toBe(false);
    }
  });
});

// Chest layout (SAF No.1 Dress, March 2024, pictures D-1 to D-10).
// Both pocket flaps have their top edge at y = 207.5 in number-1.png (measured from the picture).
const FLAP_TOP = 207.5;
// Small helpers for the layout tests: rows of boxes, their edges, and the boxes at one spot.
const medalList = badges.filter((b) => b.category === 'medals');
const skillsBadge = get('skills', 'basic-parachutist');
const foreign = (slug: string) => makeBadge('foreign-badges', slug);
const rowTop = (boxes: { y: number }[]) => Math.min(...boxes.map((b) => b.y));
const rowBottom = (boxes: { y: number; height: number }[]) => Math.max(...boxes.map((b) => b.y + b.height));
const boxesOf = (placed: Badge[], scale = 1) => layoutBadges(uniform, placed, categories, scale);
const inRow = (boxes: ReturnType<typeof boxesOf>, anchorId: string) => boxes.filter((b) => b.anchor.id === anchorId);

describe('chest layout', () => {
  it('lets all 8 medals be placed on the left chest (the PDF states no limit)', () => {
    expect(medalList).toHaveLength(8);
    const placed: Badge[] = [];
    for (const medal of medalList) {
      const r = canPlace(uniform, medal, placed, categories);
      expect(r.ok && r.anchor.id).toBe('left-chest-medals');
      placed.push(medal);
    }
  });

  it('gives medals a tall box and keeps other badges square', () => {
    const [medal, skills] = boxesOf([medalList[0], skillsBadge]);
    expect(medal.height).toBeGreaterThan(medal.width * 2);
    expect(skills.height).toBe(skills.width);
  });

  it('draws each medal at its set size: the ribbon is about 27 mm wide (85% of 32 mm), not shrunk into a square', () => {
    const [medal] = boxesOf([medalList[0]]);
    // The art is 512 px square with the ribbon 158 px wide, so a box 88.4 tall shows the ribbon at 27 mm.
    expect((medal.height * 158) / 512 / uniform.pxPerMm).toBeCloseTo(27, 0);
    expect(medal.width).toBeGreaterThan(27 * uniform.pxPerMm); // wide enough for the medal disc
  });

  it('hangs medals from a top 6 cm above the left flap, however many are worn and at any size', () => {
    for (const count of [1, 2, 7]) {
      for (const scale of [1, 1.5]) {
        const row = inRow(boxesOf(medalList.slice(0, count), scale), 'left-chest-medals');
        expect(row).toHaveLength(count);
        for (const box of row) expect(box.y).toBeCloseTo(FLAP_TOP - 60 * uniform.pxPerMm);
      }
    }
  });

  it('centres the row of medals on the pocket', () => {
    const anchor = uniform.anchors.find((a) => a.id === 'left-chest-medals')!;
    for (const count of [1, 2, 7]) {
      const row = inRow(boxesOf(medalList.slice(0, count)), 'left-chest-medals');
      const left = Math.min(...row.map((b) => b.x));
      const right = Math.max(...row.map((b) => b.x + b.width));
      expect((left + right) / 2).toBeCloseTo(anchor.x);
    }
  });

  it('puts the medals in the order they were picked', () => {
    const picked = [medalList[3], medalList[0], medalList[5]];
    const row = inRow(boxesOf(picked), 'left-chest-medals');
    expect(row.map((b) => badgeKey(b.badge))).toEqual(picked.map(badgeKey));
    expect(row[0].x).toBeLessThan(row[1].x);
    expect(row[1].x).toBeLessThan(row[2].x);
  });

  it('stands SAF badges 1 cm above the left flap when there are no medals', () => {
    const row = inRow(boxesOf([skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger')]), 'left-chest-above-pocket');
    expect(row).toHaveLength(3);
    expect(rowBottom(row)).toBeCloseTo(FLAP_TOP - 10 * uniform.pxPerMm);
  });

  it('arranges 3 SAF badges as a pyramid: the first alone on top, centred over the other two', () => {
    const three = [skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger')];
    const anchor = uniform.anchors.find((a) => a.id === 'left-chest-above-pocket')!;
    const row = inRow(boxesOf(three), 'left-chest-above-pocket');
    const [apex, left, right] = row;
    expect(row.map((b) => b.slot)).toEqual([0, 1, 2]);
    expect(left.y).toBeCloseTo(right.y); // the two lower badges share a row
    expect(apex.y).toBeLessThan(left.y); // apex stands above them
    expect(left.x).toBeLessThan(right.x);
    expect(apex.x + apex.width / 2).toBeCloseTo(anchor.x);
    expect((left.x + right.x + right.width) / 2).toBeCloseTo(anchor.x);
  });

  it('makes the 3 SAF badges a pyramid on every uniform that has the spot', () => {
    const three = [skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger')];
    for (const u of uniforms) {
      const row = layoutBadges(u, three, categories, 1).filter((b) => b.anchor.id === 'left-chest-above-pocket');
      expect(row, u.id).toHaveLength(3);
      expect(row[0].y, u.id).toBeLessThan(row[1].y);
      expect(row[1].y, u.id).toBeCloseTo(row[2].y);
    }
  });

  it('keeps SAF badges on the chest, below the shoulder board, however many medals are worn', () => {
    const three = [skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger')];
    for (const u of uniforms) {
      const minY = u.anchors.find((a) => a.id === 'left-chest-above-pocket')!.minY!;
      for (const medals of [0, 1, 7]) {
        const row = layoutBadges(u, [...three, ...medalList.slice(0, medals)], categories, 1).filter(
          (b) => b.anchor.id === 'left-chest-above-pocket',
        );
        expect(rowTop(row), `${u.id}, ${medals} medals`).toBeGreaterThanOrEqual(minY - 1e-9);
      }
    }
  });

  it('draws SAF badges and medals at one fixed size, whatever else is worn', () => {
    const three = [skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger')];
    const sizeOf = (placed: Badge[], anchorId: string) => {
      const [box] = inRow(boxesOf(placed), anchorId);
      return [box.width, box.height];
    };
    expect(sizeOf(three, 'left-chest-above-pocket')).toEqual(sizeOf([skillsBadge], 'left-chest-above-pocket'));
    expect(sizeOf([...three, medalList[0]], 'left-chest-above-pocket')).toEqual(sizeOf([skillsBadge], 'left-chest-above-pocket'));
    expect(sizeOf([...three, ...medalList], 'left-chest-medals')).toEqual(sizeOf([medalList[0]], 'left-chest-medals'));
  });

  it('keeps the pyramid a pyramid, 1 cm above the medals', () => {
    const boxes = boxesOf([skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger'), medalList[0]]);
    const [apex, left, right] = inRow(boxes, 'left-chest-above-pocket');
    expect(apex.y).toBeLessThan(left.y);
    expect(left.y).toBeCloseTo(right.y);
    expect(Math.max(left.y + left.height, right.y + right.height)).toBeCloseTo(rowTop(inRow(boxes, 'left-chest-medals')) - 10 * uniform.pxPerMm);
  });

  it('keeps 1 or 2 SAF badges in one row', () => {
    const two = inRow(boxesOf([skillsBadge, get('skills', 'combat-skills')]), 'left-chest-above-pocket');
    expect(two[0].y).toBeCloseTo(two[1].y);
    expect(two[0].x).toBeLessThan(two[1].x);
  });

  it('keeps the pyramid 1 cm above the medals', () => {
    const boxes = boxesOf([skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger'), medalList[0]]);
    const saf = inRow(boxes, 'left-chest-above-pocket');
    expect(Math.max(...saf.map((b) => b.y + b.height))).toBeCloseTo(rowTop(inRow(boxes, 'left-chest-medals')) - 10 * uniform.pxPerMm);
  });

  it('stands SAF badges 1 cm above the top of the medals when medals are worn', () => {
    const boxes = boxesOf([skillsBadge, medalList[0], medalList[1]]);
    const saf = inRow(boxes, 'left-chest-above-pocket');
    const medals = inRow(boxes, 'left-chest-medals');
    expect(rowBottom(saf)).toBeCloseTo(rowTop(medals) - 10 * uniform.pxPerMm);
  });

  it('stands foreign badges 1 cm above the right flap, with at most 3 on the right chest', () => {
    const three = [foreign('a'), foreign('b'), foreign('c')];
    const row = inRow(boxesOf(three), 'right-chest-foreign');
    expect(row).toHaveLength(3);
    expect(rowBottom(row)).toBeCloseTo(FLAP_TOP - 10 * uniform.pxPerMm);
    expect(canPlace(uniform, foreign('d'), three, categories).ok).toBe(false);
  });

  it('lines foreign badges up with the SAF badges when those are higher (worn above medals)', () => {
    const boxes = boxesOf([foreign('a'), skillsBadge, medalList[0]]);
    const saf = inRow(boxes, 'left-chest-above-pocket');
    const abroad = inRow(boxes, 'right-chest-foreign');
    expect(rowBottom(abroad)).toBeCloseTo(rowBottom(saf));
    expect(rowBottom(abroad)).toBeLessThan(FLAP_TOP - 10 * uniform.pxPerMm);
  });

  it('still gives formation badges no spot', () => {
    const r = canPlace(uniform, get('formation', '3-div'), [], categories);
    expect(!r.ok && r.reason).toContain('No placement spot');
  });
});

describe('many medals (picture D-3 draws them overlapping)', () => {
  const rowWidth = (row: { x: number; width: number }[]) =>
    Math.max(...row.map((b) => b.x + b.width)) - Math.min(...row.map((b) => b.x));
  const medalsRow = (count: number, scale = 1) =>
    inRow(boxesOf(medalList.slice(0, count), scale), 'left-chest-medals');

  it('keeps 2 medals apart, side by side', () => {
    const [first, second] = medalsRow(2);
    expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
  });

  it('overlaps 7 medals so the row is no wider than 160 mm, at any size', () => {
    for (const scale of [1, 1.5]) {
      expect(rowWidth(medalsRow(7, scale))).toBeCloseTo(160 * uniform.pxPerMm * scale);
    }
  });

  it('still keeps the picked order from left to right when overlapping', () => {
    const row = medalsRow(7);
    expect(row.map((b) => badgeKey(b.badge))).toEqual(medalList.slice(0, 7).map(badgeKey));
    for (let i = 1; i < row.length; i++) expect(row[i].x).toBeGreaterThan(row[i - 1].x);
  });
});

// Male No. 2, No. 5 and No. 5J: their own chest and lapel layouts (Guidelines for uniform.pdf, mock-up placement-draft.png).
// All sizes and positions here are uniform-image pixels; pxPerMm is 1.
/** Finds a uniform by id. */
const dress = (id: string): Uniform => uniforms.find((u) => u.id === id)!;
const SERVICES = ['army', 'rsaf', 'rsn'];
const safThree = [skillsBadge, get('skills', 'combat-skills'), get('skills', 'rigger')];
/** The boxes at one spot of a uniform. */
const at = (u: Uniform, placed: Badge[], anchorId: string, scale = 1) =>
  layoutBadges(u, placed, categories, scale).filter((b) => b.anchor.id === anchorId);
const centreX = (boxes: { x: number; width: number }[]) => (Math.min(...boxes.map((b) => b.x)) + Math.max(...boxes.map((b) => b.x + b.width))) / 2;

// The No. 2 lapel layouts. The Army drawing was redrawn (upper lapel, long lower lapel) and its layout was chosen with the
// project owner (draft F). The RSAF and RSN drawings are not redrawn yet, so they keep the first layout.
const LAPEL = {
  army: { cx: 472, medalScale: 0.495, medalTop: 190, safScale: 0.603, safGap: 1.8, rowGap: -10.5, hGap: 2 },
  rsaf: { cx: 446, medalScale: 0.557, medalTop: 165, safScale: 0.63, safGap: 8, rowGap: 2, hGap: 3 },
  rsn: { cx: 520, medalScale: 0.557, medalTop: 165, safScale: 0.63, safGap: 8, rowGap: 2, hGap: 3 },
};

describe('anchor scale (miniature medals on the No. 2 lapel)', () => {
  for (const service of SERVICES) {
    const u = dress(`number-2-${service}-male`);
    const { cx, medalScale, medalTop, safScale, safGap, rowGap, hGap } = LAPEL[service as keyof typeof LAPEL];

    it(`${u.id}: draws medals at ${medalScale} of their box, hanging from y ${medalTop}, centred on x ${cx}, 1 px apart`, () => {
      const row = at(u, medalList.slice(0, 3), 'left-chest-medals');
      expect(row).toHaveLength(3);
      for (const b of row) {
        expect(b.width).toBeCloseTo(32.3 * medalScale);
        expect(b.height).toBeCloseTo(88.4 * medalScale);
        expect(b.y).toBeCloseTo(medalTop);
        expect(b.render).toBe('art');
      }
      expect(row[1].x - (row[0].x + row[0].width)).toBeCloseTo(1);
      expect(centreX(row)).toBeCloseTo(cx);
    });

    it(`${u.id}: multiplies the spot scale with the viewer scale`, () => {
      const [medal] = at(u, [medalList[0]], 'left-chest-medals', 1.5);
      expect(medal.width).toBeCloseTo(32.3 * medalScale * 1.5);
    });

    it(`${u.id}: stands SAF badges ${safGap} px above the medals at ${safScale}, in a pyramid with ${rowGap} px between its rows`, () => {
      const placed = [...safThree, ...medalList.slice(0, 3)];
      const saf = at(u, placed, 'left-chest-above-pocket');
      const [apex, left, right] = saf;
      for (const b of saf) expect(b.width).toBeCloseTo(39 * safScale);
      expect(rowBottom(saf)).toBeCloseTo(rowTop(at(u, placed, 'left-chest-medals')) - safGap);
      expect(left.y - (apex.y + apex.height)).toBeCloseTo(rowGap); // negative: the boxes overlap, the art inside them does not
      expect(left.y).toBeCloseTo(right.y);
      expect(right.x - (left.x + left.width)).toBeCloseTo(hGap);
      expect(apex.x + apex.width / 2).toBeCloseTo(cx);
      expect(centreX([left, right])).toBeCloseTo(cx);
    });

    it(`${u.id}: keeps the SAF badges where they are with no medals (the medals hang from a fixed top)`, () => {
      expect(rowBottom(at(u, [skillsBadge], 'left-chest-above-pocket'))).toBeCloseTo(medalTop - safGap);
      expect(rowBottom(at(u, [skillsBadge, medalList[0]], 'left-chest-above-pocket'))).toBeCloseTo(medalTop - safGap);
    });
  }
});

describe('ribbon bar (render "ribbon" on No. 5 and No. 5J)', () => {
  const dresses = [
    { id: 'number-5', x: 450, bottom: 219 },
    { id: 'number-5j', x: 520, bottom: 232 },
  ];
  for (const { id, x, bottom } of dresses) {
    for (const service of SERVICES) {
      const u = dress(`${id}-${service}-male`);

      it(`${u.id}: draws each medal as a 17.6 x 12 ribbon, 3 abreast with no gap, centred on x ${x}, standing on y ${bottom}`, () => {
        const row = at(u, medalList.slice(0, 3), 'left-chest-medals');
        expect(row).toHaveLength(3);
        for (const b of row) {
          expect(b.render).toBe('ribbon');
          expect(b.width).toBeCloseTo(17.6);
          expect(b.height).toBeCloseTo(12);
          expect(b.y + b.height).toBeCloseTo(bottom);
        }
        expect(row[1].x).toBeCloseTo(row[0].x + 17.6);
        expect(row[2].x).toBeCloseTo(row[1].x + 17.6);
        expect(centreX(row)).toBeCloseTo(x);
        expect(Math.max(...row.map((b) => b.x + b.width)) - Math.min(...row.map((b) => b.x))).toBeCloseTo(52.8);
        expect(row.map((b) => badgeKey(b.badge))).toEqual(medalList.slice(0, 3).map(badgeKey)); // the order picked
      });
    }
  }

  const five = dress('number-5-army-male');

  it('centres a short bar on the anchor too (1 and 2 ribbons)', () => {
    expect(centreX(at(five, medalList.slice(0, 1), 'left-chest-medals'))).toBeCloseTo(450);
    expect(centreX(at(five, medalList.slice(0, 2), 'left-chest-medals'))).toBeCloseTo(450);
  });

  it('stacks a fourth ribbon in a new row above the first, centred, and the next rows above that', () => {
    const row = at(five, medalList.slice(0, 7), 'left-chest-medals');
    expect(row).toHaveLength(7);
    expect(row[3].y + row[3].height).toBeCloseTo(219 - 12);
    expect(centreX(row.slice(3, 6))).toBeCloseTo(450); // a full second row
    expect(row[6].y + row[6].height).toBeCloseTo(219 - 24);
    expect(row[6].x + row[6].width / 2).toBeCloseTo(450); // the seventh stands alone above them, centred
    expect(row.map((b) => b.slot)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('scales a ribbon with the viewer scale but keeps the bottom edge of the bar', () => {
    const [ribbon] = at(five, [medalList[0]], 'left-chest-medals', 1.5);
    expect(ribbon.width).toBeCloseTo(17.6 * 1.5);
    expect(ribbon.height).toBeCloseTo(12 * 1.5);
    expect(ribbon.y + ribbon.height).toBeCloseTo(219);
  });

  it('draws whole medals (not ribbons) on No. 1 and on the No. 2 lapel', () => {
    expect(layoutBadges(uniform, [medalList[0]], categories, 1)[0].render).toBe('art');
    expect(layoutBadges(dress('number-2-army-male'), [medalList[0]], categories, 1)[0].render).toBe('art');
  });

  it('gives every medal a ribbon crop inside its 512 px art, and a default band for one without', () => {
    for (const medal of medalList) {
      const r = ribbonCrop(medal);
      expect(medal.ribbon, medal.slug).toBeDefined();
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(ART_PX);
      expect(r.y + r.height).toBeLessThanOrEqual(ART_PX);
    }
    const fallback = ribbonCrop({ widthMm: 32.3, heightMm: 88.4 });
    expect(fallback.width).toBeCloseTo((ART_PX * 32.3) / 88.4);
    expect(fallback.x + fallback.width / 2).toBeCloseTo(ART_PX / 2);
  });

  it('reads the ribbon size from the anchor, with 17.6 x 12 and 3 a row as the default', () => {
    expect(ribbonSpec({})).toEqual({ widthMm: 17.6, heightMm: 12, perRow: 3 });
    expect(ribbonSpec(five.anchors.find((a) => a.id === 'left-chest-medals')!)).toEqual({ widthMm: 17.6, heightMm: 12, perRow: 3 });
  });

  for (const { id, x } of dresses) for (const service of SERVICES) {
    const u = dress(`${id}-${service}-male`);

    it(`${u.id}: stands SAF badges 6.4 px above the top of the ribbons, scaled 0.96, 6 px of art between the pyramid rows`, () => {
      for (const medals of [1, 4]) {
        const placed = [...safThree, ...medalList.slice(0, medals)];
        const saf = at(u, placed, 'left-chest-above-pocket');
        const [apex, left, right] = saf;
        expect(rowBottom(saf)).toBeCloseTo(rowTop(at(u, placed, 'left-chest-medals')) - 6.4);
        for (const b of saf) expect(b.width).toBeCloseTo(39 * 0.96);
        expect(left.y - (apex.y + apex.height)).toBeCloseTo(-4.7); // the boxes overlap; the art inside them is about 6 px apart
        expect(right.x - (left.x + left.width)).toBeCloseTo(9);
        expect(apex.x + apex.width / 2).toBeCloseTo(x);
        expect(centreX([left, right])).toBeCloseTo(x);
      }
    });

    it(`${u.id}: stands the SAF badges where one row of ribbons would put them when no medals are worn`, () => {
      const ribbonTop = rowTop(at(u, [medalList[0]], 'left-chest-medals'));
      expect(rowBottom(at(u, [skillsBadge], 'left-chest-above-pocket'))).toBeCloseTo(ribbonTop - 6.4);
    });
  }
});

describe('IPPT, marksmanship and the silver arms badge on the male No. 2, No. 5 and No. 5J', () => {
  const ippt = get('proficiency', 'ippt-gold');
  const marksmanship = get('proficiency', 'marksmanship');

  for (const service of SERVICES) {
    const u = dress(`number-2-${service}-male`);

    it(`${u.id}: has no proficiency spot on the sleeve, only on the left upper lapel`, () => {
      expect(u.anchors.some((a) => a.id === 'left-shoulder-sleeve')).toBe(false);
      for (const badge of [ippt, get('proficiency', 'ippt-silver'), marksmanship]) {
        const r = canPlace(u, badge, [], categories);
        expect(r.ok && r.anchor.id).toBe('left-upper-lapel');
      }
      expect(u.anchors.find((a) => a.id === 'left-upper-lapel')?.flat).toBe(true);
    });

    const pinsAt = service === 'army' ? { x: 472, y: 109.5 } : { x: 481, y: 118 };
    it(`${u.id}: draws the two pins one above the other, IPPT on top whichever was picked first, centred on (${pinsAt.x}, ${pinsAt.y})`, () => {
      for (const picked of [[ippt, marksmanship], [marksmanship, ippt]]) {
        const [first, second] = at(u, picked, 'left-upper-lapel');
        expect(first.badge).toBe(ippt);
        expect(second.badge).toBe(marksmanship);
        expect(first.x + first.width / 2).toBeCloseTo(pinsAt.x); // one vertical line
        expect(second.x + second.width / 2).toBeCloseTo(pinsAt.x);
        expect(second.y - (first.y + first.height)).toBeCloseTo(2);
        expect((first.y + second.y + second.height) / 2).toBeCloseTo(pinsAt.y); // the pair is centred on the spot
        // The art of both fills 451 of its 512 px across.
        expect((first.width * 451) / ART_PX).toBeCloseTo(14, 0);
        expect((second.width * 451) / ART_PX).toBeCloseTo(16, 0);
      }
    });

    it(`${u.id}: still allows one IPPT badge and then the marksmanship badge`, () => {
      expect(canPlace(u, get('proficiency', 'ippt-silver'), [ippt], categories).ok).toBe(false);
      expect(canPlace(u, marksmanship, [ippt], categories).ok).toBe(true);
    });
  }

  it('keeps IPPT and marksmanship on the left sleeve of No. 5 and No. 5J, marksmanship below IPPT', () => {
    for (const id of ['number-5-army-male', 'number-5-rsn-male', 'number-5j-army-male', 'number-5j-rsaf-male']) {
      const u = dress(id);
      const r = canPlace(u, ippt, [], categories);
      expect(r.ok && r.anchor.id, id).toBe('left-shoulder-sleeve');
      const [top, bottom] = at(u, [marksmanship, ippt], 'left-shoulder-sleeve');
      expect(top.badge, id).toBe(ippt);
      expect(bottom.y, id).toBeGreaterThan(top.y);
    }
  });

  // The silver pins are all drawn 346 px tall in their 512 px square; the infantry pin (the narrowest) is 258 px wide.
  const SILVER_INFANTRY_WIDTH = 258;
  const visible = (width: number) => (width * SILVER_INFANTRY_WIDTH) / ART_PX;

  it('puts the silver arms badge on the upper lapel of No. 2 (20 px on the Army drawing, 14 px on the others) and on the collar of No. 5 and No. 5J (16 px)', () => {
    const arms = get('arms', 'infantry');
    const [army] = layoutBadges(dress('number-2-army-male'), [arms], categories, 1);
    expect(army.anchor.id).toBe('right-upper-lapel');
    expect(visible(army.width)).toBeCloseTo(20, 0);
    expect(army.x + army.width / 2).toBeCloseTo(262);
    expect(army.y + army.height / 2).toBeCloseTo(110);
    for (const service of ['rsaf', 'rsn']) {
      const [lapel] = layoutBadges(dress(`number-2-${service}-male`), [arms], categories, 1);
      expect(visible(lapel.width), service).toBeCloseTo(14, 0);
      expect(lapel.x + lapel.width / 2, service).toBeCloseTo(252);
      expect(lapel.y + lapel.height / 2, service).toBeCloseTo(93);
    }
    for (const id of ['number-5', 'number-5j']) {
      for (const service of SERVICES) {
        const boxes = layoutBadges(dress(`${id}-${service}-male`), [arms], categories, 1);
        expect(boxes, id).toHaveLength(1);
        expect(visible(boxes[0].width), id).toBeCloseTo(16, 0);
        expect(boxes[0].x + boxes[0].width / 2, id).toBeCloseTo(330);
        expect(boxes[0].y + boxes[0].height / 2, id).toBeCloseTo(98);
        expect(boxes[0].rotation, id).toBe(0);
      }
    }
  });

});
