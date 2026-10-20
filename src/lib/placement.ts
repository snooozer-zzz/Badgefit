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

  const tooMany = tooManyOnSpot(uniform, anchor, placed);
  if (tooMany) return { ok: false, reason: tooMany };

  const clash = badge.exclusiveGroup && placed.find((p) => p.exclusiveGroup === badge.exclusiveGroup);
  if (clash) {
    return {
      ok: false,
      reason: `Only one ${badge.exclusiveGroup} badge is worn. ${clash.name} is already on the uniform.`,
    };
  }

  return { ok: true, anchor };
}

/** The spot's own limit counts every category placed there (e.g. 3 SAF badges on the left chest). */
function tooManyOnSpot(uniform: Uniform, anchor: Anchor, placed: Badge[]): string | null {
  if (anchor.maxItems === undefined) return null;
  const count = placed.filter((p) => findAnchor(uniform, p) === anchor).length;
  if (count < anchor.maxItems) return null;
  return `Not more than ${anchor.maxItems} badges can be worn at: ${anchor.label}.`;
}

/**
 * Places a badge, applying the rules. For a category worn one at a time (maxWorn 1, e.g. shoulder
 * boards: one rank), picking another item of it swaps the old one out instead of refusing.
 */
export type PlaceOutcome =
  | { ok: true; anchor: Anchor; placed: Badge[]; replaced: Badge | null }
  | { ok: false; reason: string };

export function placeBadge(
  uniform: Uniform,
  badge: Badge,
  placed: Badge[],
  categories: Category[],
): PlaceOutcome {
  const category = categories.find((c) => c.id === badge.category);
  const current =
    category?.maxWorn === 1 ? placed.find((p) => p.category === badge.category && badgeKey(p) !== badgeKey(badge)) : undefined;
  const rest = current ? placed.filter((p) => p !== current) : placed;
  const r = canPlace(uniform, badge, rest, categories);
  if (!r.ok) return r;
  return { ok: true, anchor: r.anchor, placed: [...rest, badge], replaced: current ?? null };
}

export interface PlacedBox {
  badge: Badge;
  anchor: Anchor;
  /** Position among the badges sharing this anchor (0 = first). Picks the perspective sprite slot. */
  slot: number;
  /** Top-left corner and size of the box the art is drawn in, in uniform image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise about the middle of the box. 0 = upright. */
  rotation: number;
  /** 0 for the badge itself, 1 for its copy on the second side (anchor.copy). */
  side: number;
}

/** Size of a badge's box in pixels. Most badges are square; tall art (medals) has a heightMm. */
function boxSize(badge: Badge, pxPerMm: number): { width: number; height: number } {
  return { width: badge.widthMm * pxPerMm, height: (badge.heightMm ?? badge.widthMm) * pxPerMm };
}

/** Highest edge (smallest y) of a row of boxes, or null when nothing is worn there. */
function topOf(row: PlacedBox[]): number | null {
  return row.length === 0 ? null : Math.min(...row.map((b) => b.y));
}

/** Lowest edge (largest y) of a row of boxes, or null when nothing is worn there. */
function bottomOf(row: PlacedBox[]): number | null {
  return row.length === 0 ? null : Math.max(...row.map((b) => b.y + b.height));
}

/** The placed badges of one spot, ordered: category order, then layoutOrder, then the order added. */
function badgesAt(uniform: Uniform, anchor: Anchor, placed: Badge[], categories: Category[]): Badge[] {
  const orderOf = new Map(categories.map((c) => [c.id, c.order]));
  return placed
    .map((badge, index) => ({ badge, index }))
    .filter(({ badge }) => findAnchor(uniform, badge) === anchor)
    .sort(
      (a, b) =>
        (orderOf.get(a.badge.category) ?? 0) - (orderOf.get(b.badge.category) ?? 0) ||
        (a.badge.layoutOrder ?? 0) - (b.badge.layoutOrder ?? 0) ||
        a.index - b.index,
    )
    .map(({ badge }) => badge);
}

/**
 * A pyramid has the first badge alone on top and the rest in a row below (3 badges: 1 above 2).
 * Fewer than 3 stay in one row. Each row is centred on the anchor and the bottom row stands on edgeY.
 */
function arrangePyramid(anchor: Anchor, items: Badge[], edgeY: number, pxPerMm: number): PlacedBox[] {
  const topCount = Math.floor(items.length / 2);
  const bottom = rowOf(anchor, items.slice(topCount), topCount, edgeY, pxPerMm);
  const top = rowOf(anchor, items.slice(0, topCount), 0, Math.min(...bottom.map((b) => b.y)) - (anchor.layout.rowGapPx ?? anchor.layout.gapPx), pxPerMm);
  return [...top, ...bottom];
}

/**
 * Puts the boxes of one spot side by side (or one above the other), centred on the anchor.
 * Sizes never depend on how many badges are worn.
 */
function arrange(anchor: Anchor, items: Badge[], edgeY: number, pxPerMm: number): PlacedBox[] {
  const pyramid = !!anchor.layout.pyramid && anchor.layout.direction === 'horizontal' && items.length >= 3;
  const row = pyramid ? arrangePyramid(anchor, items, edgeY, pxPerMm) : rowOf(anchor, items, 0, edgeY, pxPerMm);

  const { copy } = anchor;
  if (!copy) return row;
  const shifted = row.map((b): PlacedBox => ({
    ...b,
    x: b.x + copy.x - anchor.x,
    y: b.y + copy.y - anchor.y,
    rotation: copy.rotation ?? 0,
    side: 1,
  }));
  return [...row, ...shifted];
}

/** One row (or column) of boxes. `firstSlot` is the slot of the first item among all the badges at the spot. */
function rowOf(anchor: Anchor, items: Badge[], firstSlot: number, edgeY: number, pxPerMm: number): PlacedBox[] {
  if (items.length === 0) return [];
  const horizontal = anchor.layout.direction === 'horizontal';
  const sizes = items.map((b) => boxSize(b, pxPerMm));
  const lengths = sizes.map((s) => (horizontal ? s.width : s.height));
  const sum = lengths.reduce((a, b) => a + b, 0);
  let gap = anchor.layout.gapPx;
  // A row that is too wide overlaps its badges (a negative gap) until it fits, as picture D-3 draws 7 medals.
  const maxLength = horizontal && anchor.layout.maxWidthMm ? anchor.layout.maxWidthMm * pxPerMm : Infinity;
  if (items.length > 1 && sum + gap * (items.length - 1) > maxLength) gap = (maxLength - sum) / (items.length - 1);
  const total = sum + gap * (items.length - 1);
  let cursor = (horizontal ? anchor.x : edgeY) - total / 2;
  // In a row, 'top' and 'bottom' line the boxes up by that edge. Without align they are centred.
  const align = anchor.layout.align ?? 'center';

  return items.map((badge, i): PlacedBox => {
    const { width, height } = sizes[i];
    const rowY = align === 'top' ? edgeY : align === 'bottom' ? edgeY - height : edgeY - height / 2;
    const box = horizontal
      ? { x: cursor, y: rowY }
      : { x: anchor.x - width / 2, y: cursor };
    cursor += lengths[i] + gap;
    return { badge, anchor, slot: firstSlot + i, ...box, width, height, rotation: anchor.rotation ?? 0, side: 0 };
  });
}

/**
 * Arranges placed badges around their anchors. Badges sharing an anchor are ordered by category
 * order (so exceptional skills come before skills), then by layoutOrder (IPPT below marksmanship),
 * then by the order they were added.
 * `scale` enlarges badges for readability; 1 = real-world size from widthMm and pxPerMm.
 * Gaps between spots (stackAbove) are real distances, so `scale` does not change them.
 */
export function layoutBadges(
  uniform: Uniform,
  placed: Badge[],
  categories: Category[],
  scale: number,
): PlacedBox[] {
  const rows = new Map<string, PlacedBox[]>();

  // The row at one spot. Worked out once, because other spots can depend on it.
  const rowAt = (anchor: Anchor | undefined): PlacedBox[] => {
    if (!anchor) return [];
    const known = rows.get(anchor.id);
    if (known) return known;
    rows.set(anchor.id, []); // stops a spot that (wrongly) depends on itself from looping forever
    const items = badgesAt(uniform, anchor, placed, categories);
    const row = arrange(anchor, items, edgeYOf(anchor), uniform.pxPerMm * scale * (anchor.scale ?? 1));
    rows.set(anchor.id, row);
    return row;
  };

  const anchorById = (id: string) => uniform.anchors.find((a) => a.id === id);

  // The y a row is lined up on: the anchor's own y, unless it sits above or in line with another spot.
  const edgeYOf = (anchor: Anchor): number => {
    let y = anchor.y;
    if (anchor.stackAbove) {
      const top = topOf(rowAt(anchorById(anchor.stackAbove.anchor)));
      if (top !== null) y = top - anchor.stackAbove.mmGap * uniform.pxPerMm;
    }
    if (anchor.inLineWith) {
      const bottom = bottomOf(rowAt(anchorById(anchor.inLineWith)));
      if (bottom !== null) y = Math.min(y, bottom);
    }
    return y;
  };

  return uniform.anchors.flatMap((anchor) => rowAt(anchor));
}
