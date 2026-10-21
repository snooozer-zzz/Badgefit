// Works out where every worn badge is drawn on the uniform picture (position and size, in image pixels).
// It does not decide what may be worn: those rules are in placement.ts.
import type { Anchor, Badge, Category, Uniform } from '../data/schema';
import { badgeKey, findAnchor } from './placement';
import { ribbonSpec } from './ribbon';

/** One badge ready to draw: the box its art goes in. */
export interface PlacedBox {
  badge: Badge;
  anchor: Anchor;
  /** Position among the badges sharing this anchor (0 = first). Picks the perspective sprite slot. */
  slot: number;
  /** Top-left corner and size of the box, in uniform image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise about the middle of the box. 0 = upright. */
  rotation: number;
  /** 0 for the badge itself, 1 for its copy on the second side (anchor.copy). */
  side: number;
  /** 'art' = the whole badge; 'ribbon' = only the ribbon of a medal, drawn in a small box (anchor.render). */
  render: 'art' | 'ribbon';
}

/** The size of a badge's box in pixels. Most badges are square; tall art (medals) has a heightMm. */
function boxSize(badge: Badge, pxPerMm: number): { width: number; height: number } {
  return { width: badge.widthMm * pxPerMm, height: (badge.heightMm ?? badge.widthMm) * pxPerMm };
}

/** Makes an upright, first-side box. The caller gives the position and size. */
function newBox(
  anchor: Anchor,
  badge: Badge,
  slot: number,
  place: { x: number; y: number; width: number; height: number },
  render: 'art' | 'ribbon',
): PlacedBox {
  return { badge, anchor, slot, ...place, rotation: anchor.rotation ?? 0, side: 0, render };
}

/** The highest edge (smallest y) of a row of boxes, or null when the row is empty. */
function topOf(row: PlacedBox[]): number | null {
  return row.length === 0 ? null : Math.min(...row.map((b) => b.y));
}

/** The lowest edge (largest y) of a row of boxes, or null when the row is empty. */
function bottomOf(row: PlacedBox[]): number | null {
  return row.length === 0 ? null : Math.max(...row.map((b) => b.y + b.height));
}

/** The badges worn at one spot, ordered by category order, then layoutOrder, then the order they were added. */
function badgesAt(uniform: Uniform, anchor: Anchor, placed: Badge[], categories: Category[]): Badge[] {
  const categoryOrder = new Map(categories.map((c) => [c.id, c.order]));
  return placed
    .map((badge, index) => ({ badge, index }))
    .filter(({ badge }) => findAnchor(uniform, badge) === anchor)
    .sort(
      (a, b) =>
        (categoryOrder.get(a.badge.category) ?? 0) - (categoryOrder.get(b.badge.category) ?? 0) ||
        (a.badge.layoutOrder ?? 0) - (b.badge.layoutOrder ?? 0) ||
        a.index - b.index,
    )
    .map(({ badge }) => badge);
}

/**
 * The gap between neighbours in a row. It is the anchor's gap, unless the row would be wider than maxWidthMm:
 * then the gap goes negative so the badges overlap until the row fits (picture D-3 draws 7 medals like this).
 */
function gapFor(anchor: Anchor, lengths: number[], pxPerMm: number): number {
  const gap = anchor.layout.gapPx;
  const maxMm = anchor.layout.maxWidthMm;
  if (anchor.layout.direction !== 'horizontal' || !maxMm || lengths.length < 2) return gap;

  const sum = lengths.reduce((a, b) => a + b, 0);
  const maxLength = maxMm * pxPerMm;
  if (sum + gap * (lengths.length - 1) <= maxLength) return gap;
  return (maxLength - sum) / (lengths.length - 1);
}

/**
 * One row (or column) of boxes, centred on the anchor. `firstSlot` is the slot of the first item among all
 * the badges at the spot. `edgeY` is the y the row is lined up on (its top, bottom or middle, see layout.align).
 */
function rowOf(anchor: Anchor, items: Badge[], firstSlot: number, edgeY: number, pxPerMm: number): PlacedBox[] {
  if (items.length === 0) return [];
  const horizontal = anchor.layout.direction === 'horizontal';
  const sizes = items.map((b) => boxSize(b, pxPerMm * (anchor.itemScales?.[badgeKey(b)] ?? 1)));
  const lengths = sizes.map((s) => (horizontal ? s.width : s.height));
  const gap = gapFor(anchor, lengths, pxPerMm);
  const total = lengths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  const align = anchor.layout.align ?? 'center';

  let cursor = (horizontal ? anchor.x : edgeY) - total / 2;
  return items.map((badge, i) => {
    const { width, height } = sizes[i];
    const rowY = align === 'top' ? edgeY : align === 'bottom' ? edgeY - height : edgeY - height / 2;
    const corner = horizontal ? { x: cursor, y: rowY } : { x: anchor.x - width / 2, y: cursor };
    cursor += lengths[i] + gap;
    return newBox(anchor, badge, firstSlot + i, { ...corner, width, height }, 'art');
  });
}

/**
 * A pyramid: the first badge or two stand alone on top, the rest in a row below (3 badges: 1 above 2).
 * The bottom row stands on edgeY, the top row sits above it with the anchor's rowGapPx between them.
 */
function pyramidOf(anchor: Anchor, items: Badge[], edgeY: number, pxPerMm: number): PlacedBox[] {
  const topCount = Math.floor(items.length / 2);
  const bottom = rowOf(anchor, items.slice(topCount), topCount, edgeY, pxPerMm);
  const rowGap = anchor.layout.rowGapPx ?? anchor.layout.gapPx;
  const topEdge = Math.min(...bottom.map((b) => b.y)) - rowGap;
  const top = rowOf(anchor, items.slice(0, topCount), 0, topEdge, pxPerMm);
  return [...top, ...bottom];
}

/**
 * A ribbon bar: each medal is a small box with no gap between them, `perRow` to a row. Every row is centred
 * on the anchor. The first row stands on edgeY and each further row sits on top of the one before.
 */
function ribbonsOf(anchor: Anchor, items: Badge[], edgeY: number, pxPerMm: number): PlacedBox[] {
  const { widthMm, heightMm, perRow } = ribbonSpec(anchor);
  const width = widthMm * pxPerMm;
  const height = heightMm * pxPerMm;
  return items.map((badge, i) => {
    const row = Math.floor(i / perRow);
    const inThisRow = Math.min(perRow, items.length - row * perRow);
    const left = anchor.x - (inThisRow * width) / 2;
    const place = { x: left + (i % perRow) * width, y: edgeY - height * (row + 1), width, height };
    return newBox(anchor, badge, i, place, 'ribbon');
  });
}

/** Adds the copy of a row on the second side (both collars), moved and turned as the anchor's `copy` says. */
function withCopy(anchor: Anchor, row: PlacedBox[]): PlacedBox[] {
  const { copy } = anchor;
  if (!copy) return row;
  const moved = row.map((b): PlacedBox => ({
    ...b,
    x: b.x + copy.x - anchor.x,
    y: b.y + copy.y - anchor.y,
    rotation: copy.rotation ?? 0,
    side: 1,
  }));
  return [...row, ...moved];
}

/** Arranges the badges of one spot the way its layout says: ribbon bar, pyramid or a plain row. */
function arrange(anchor: Anchor, items: Badge[], edgeY: number, pxPerMm: number): PlacedBox[] {
  const wantsPyramid = !!anchor.layout.pyramid && anchor.layout.direction === 'horizontal' && items.length >= 3;
  if (anchor.render === 'ribbon') return withCopy(anchor, ribbonsOf(anchor, items, edgeY, pxPerMm));
  if (wantsPyramid) return withCopy(anchor, pyramidOf(anchor, items, edgeY, pxPerMm));
  return withCopy(anchor, rowOf(anchor, items, 0, edgeY, pxPerMm));
}

/**
 * Works out the box of every worn badge on the uniform.
 * `scale` enlarges all badges (1 = real-world size from widthMm and pxPerMm). A spot's own `scale` (miniatures)
 * multiplies on top of that. Gaps between spots (stackAbove) are real distances, so scale does not change them.
 */
export function layoutBadges(uniform: Uniform, placed: Badge[], categories: Category[], scale: number): PlacedBox[] {
  const rows = new Map<string, PlacedBox[]>();

  // The row at one spot. It is worked out once, because other spots can sit above it or in line with it.
  const rowAt = (anchor: Anchor | undefined): PlacedBox[] => {
    if (!anchor) return [];
    const known = rows.get(anchor.id);
    if (known) return known;
    rows.set(anchor.id, []); // stops a spot that (wrongly) depends on itself from looping forever
    const items = badgesAt(uniform, anchor, placed, categories);
    const pxPerMm = uniform.pxPerMm * scale * (anchor.scale ?? 1);
    const row = arrange(anchor, items, edgeYOf(anchor), pxPerMm);
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
