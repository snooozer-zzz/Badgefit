import { describe, expect, it } from 'vitest';
import { badges, categories, uniforms } from '../data';
import { badgeKey, canPlace, layoutBadges } from './placement';

const uniform = uniforms[0];
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
