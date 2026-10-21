// The placement rules: which badge may go where, and how many. Pure functions with no screen code,
// so they are easy to test (placement.test.ts). Where a badge is drawn is worked out in layout.ts.
import type { Anchor, Badge, Category, Uniform } from '../data/schema';

/** The unique key of a badge: its category and slug, like "medals/good-service". */
export const badgeKey = (b: Pick<Badge, 'category' | 'slug'>): string => `${b.category}/${b.slug}`;

/** The first spot on this uniform that accepts the badge's category, or undefined when there is none. */
export function findAnchor(uniform: Uniform, badge: Pick<Badge, 'category'>): Anchor | undefined {
  return uniform.anchors.find((a) => a.accepts.includes(badge.category));
}

/** The answer of canPlace: the spot to use, or the reason the badge cannot go on. */
export type PlaceResult = { ok: true; anchor: Anchor } | { ok: false; reason: string };

/** Checks every rule for adding one badge to the badges already worn. Does not change anything. */
export function canPlace(uniform: Uniform, badge: Badge, placed: Badge[], categories: Category[]): PlaceResult {
  const category = categories.find((c) => c.id === badge.category);
  if (!category) return { ok: false, reason: `Unknown category "${badge.category}".` };

  if (placed.some((p) => badgeKey(p) === badgeKey(badge))) {
    return { ok: false, reason: `${badge.name} is already on the uniform.` };
  }

  const anchor = findAnchor(uniform, badge);
  if (!anchor) {
    const where = category.wornOn ? `Worn on: ${category.wornOn}.` : 'The source page does not say where these are worn.';
    return { ok: false, reason: `No placement spot for ${category.name} on ${uniform.name}. ${where}` };
  }

  const tooManyInCategory = categoryIsFull(category, badge, placed);
  if (tooManyInCategory) return { ok: false, reason: tooManyInCategory };

  const tooManyOnSpot = spotIsFull(uniform, anchor, placed);
  if (tooManyOnSpot) return { ok: false, reason: tooManyOnSpot };

  const clash = badge.exclusiveGroup && placed.find((p) => p.exclusiveGroup === badge.exclusiveGroup);
  if (clash) {
    return { ok: false, reason: `Only one ${badge.exclusiveGroup} badge is worn. ${clash.name} is already on the uniform.` };
  }

  return { ok: true, anchor };
}

/** The category's own limit (maxWorn), as a message, or null while there is room. */
function categoryIsFull(category: Category, badge: Badge, placed: Badge[]): string | null {
  if (category.maxWorn === null) return null;
  const count = placed.filter((p) => p.category === badge.category).length;
  if (count < category.maxWorn) return null;
  return `Not more than ${category.maxWorn} ${category.name.toLowerCase()} can be worn at any one time.`;
}

/** The spot's own limit (maxItems), as a message, or null while there is room. It counts every category on the spot. */
function spotIsFull(uniform: Uniform, anchor: Anchor, placed: Badge[]): string | null {
  if (anchor.maxItems === undefined) return null;
  const count = placed.filter((p) => findAnchor(uniform, p) === anchor).length;
  if (count < anchor.maxItems) return null;
  return `Not more than ${anchor.maxItems} badges can be worn at: ${anchor.label}.`;
}

/** The answer of placeBadge: the new list of worn badges (and the one swapped out), or the reason it failed. */
export type PlaceOutcome =
  | { ok: true; anchor: Anchor; placed: Badge[]; replaced: Badge | null }
  | { ok: false; reason: string };

/**
 * Places a badge, applying the rules. A category worn one at a time (maxWorn 1, like shoulder boards) swaps:
 * picking another item of it takes the old one off instead of refusing.
 */
export function placeBadge(uniform: Uniform, badge: Badge, placed: Badge[], categories: Category[]): PlaceOutcome {
  const category = categories.find((c) => c.id === badge.category);
  const isSwap = category?.maxWorn === 1;
  const old = isSwap ? placed.find((p) => p.category === badge.category && badgeKey(p) !== badgeKey(badge)) : undefined;
  const rest = old ? placed.filter((p) => p !== old) : placed;

  const result = canPlace(uniform, badge, rest, categories);
  if (!result.ok) return result;
  return { ok: true, anchor: result.anchor, placed: [...rest, badge], replaced: old ?? null };
}
