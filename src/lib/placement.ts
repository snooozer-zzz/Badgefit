import type { Anchor, Badge, Category, Uniform } from '../data/schema';

/** Unique key for a badge: category + slug. */
export const badgeKey = (b: Pick<Badge, 'category' | 'slug'>): string => `${b.category}/${b.slug}`;

/** Where a badge would go on this uniform, if anywhere. */
export function findAnchor(uniform: Uniform, badge: Pick<Badge, 'category'>): Anchor | undefined {
  return uniform.anchors.find((a) => a.accepts.includes(badge.category));
}

export type PlaceResult = { ok: true; anchor: Anchor } | { ok: false; reason: string };

/** Applies the placement rules. Pure function: easy to unit test and to extend with new rules. */
export function canPlace(
  uniform: Uniform,
  badge: Badge,
  placed: Badge[],
  categories: Category[],
): PlaceResult {
  const category = categories.find((c) => c.id === badge.category);
  if (!category) return { ok: false, reason: `Unknown category "${badge.category}".` };

  if (placed.some((p) => badgeKey(p) === badgeKey(badge))) {
    return { ok: false, reason: `${badge.name} is already on the uniform.` };
  }

  const anchor = findAnchor(uniform, badge);
  if (!anchor) {
    const where = category.wornOn
      ? `Worn on: ${category.wornOn}.`
      : 'The source page does not say where these are worn.';
    return { ok: false, reason: `No placement spot for ${category.name} on ${uniform.name}. ${where}` };
  }

  if (category.maxWorn !== null) {
    const count = placed.filter((p) => p.category === badge.category).length;
    if (count >= category.maxWorn) {
      return {
        ok: false,
        reason: `Not more than ${category.maxWorn} ${category.name.toLowerCase()} can be worn at any one time.`,
      };
    }
  }

  return { ok: true, anchor };
}

export interface PlacedBox {
  badge: Badge;
  anchor: Anchor;
  /** Top-left corner and side length, in uniform image pixels. */
  x: number;
  y: number;
  size: number;
}

/**
 * Arranges placed badges around their anchors. Badges sharing an anchor are ordered by category
 * order (so exceptional skills come before skills), then by the order they were added.
 * `scale` enlarges badges for readability; 1 = real-world size from widthMm and pxPerMm.
 */
export function layoutBadges(
  uniform: Uniform,
  placed: Badge[],
  categories: Category[],
  scale: number,
): PlacedBox[] {
  const orderOf = new Map(categories.map((c) => [c.id, c.order]));
  const boxes: PlacedBox[] = [];

  for (const anchor of uniform.anchors) {
    const items = placed
      .map((badge, index) => ({ badge, index }))
      .filter(({ badge }) => findAnchor(uniform, badge) === anchor)
      .sort(
        (a, b) =>
          (orderOf.get(a.badge.category) ?? 0) - (orderOf.get(b.badge.category) ?? 0) ||
          a.index - b.index,
      )
      .map(({ badge }) => badge);
    if (items.length === 0) continue;

    const sizes = items.map((b) => b.widthMm * uniform.pxPerMm * scale);
    const gap = anchor.layout.gapPx;
    const total = sizes.reduce((sum, s) => sum + s, 0) + gap * (items.length - 1);
    let cursor = (anchor.layout.direction === 'horizontal' ? anchor.x : anchor.y) - total / 2;

    items.forEach((badge, i) => {
      const size = sizes[i];
      if (anchor.layout.direction === 'horizontal') {
        boxes.push({ badge, anchor, x: cursor, y: anchor.y - size / 2, size });
      } else {
        boxes.push({ badge, anchor, x: anchor.x - size / 2, y: cursor, size });
      }
      cursor += size + gap;
    });
  }
  return boxes;
}
