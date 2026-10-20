import type { Badge, Category } from '../data/schema';

/** The categories the badge library shows: the ones flagged `selectable` in categories.json. */
export const libraryCategories = (categories: Category[]): Category[] => categories.filter((c) => c.selectable);

/** The badges the library shows: those of its categories. */
export function libraryBadges(badges: Badge[], categories: Category[]): Badge[] {
  const ids = new Set(libraryCategories(categories).map((c) => c.id));
  return badges.filter((b) => ids.has(b.category));
}
