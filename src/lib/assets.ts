import type { Badge } from '../data/schema';

/** Resolves a path under public/ so it also works when the app runs from file:// inside Capacitor. */
export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

/** Convention: redrawn art lives at public/badges/<category>/<slug>.png */
export const badgeArtPath = (b: Pick<Badge, 'category' | 'slug'>): string =>
  `badges/${b.category}/${b.slug}.png`;

/** Short label for the placeholder tile, e.g. "IPPT Gold" -> "IG". */
export function initials(name: string): string {
  const letters = name
    .replace(/[()]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) ? w : w[0].toUpperCase()));
  return letters.join('').slice(0, 3);
}
