// The selection screen's logic: what the user picks (service, gender, dress, rank, branch), the dropdown
// lines for each pick, and the badges that the pick makes the uniform wear (the loadout).
import type { Badge, Category, Options, Uniform } from '../data/schema';
import { placeBadge } from './placement';

/** What the user picks on the selection screen. null = not picked yet. */
export interface Selection {
  service: string | null;
  gender: string | null;
  /** A dress id from options.json ("number-1"), not a uniform id: the uniform follows from dress, service and gender. */
  dress: string | null;
  /** A rank code, e.g. "2LT". Sets the shoulder board and the rank insignia together. */
  rank: string | null;
  /** The slug of an arms badge. Sets the collar badge. */
  branch: string | null;
}

export const EMPTY_SELECTION: Selection = { service: null, gender: null, dress: null, rank: null, branch: null };

/** One line of a dropdown. */
export interface Option {
  id: string;
  label: string;
  /** Extra words the search matches besides the label, e.g. a rank code. */
  keywords?: string[];
  disabled?: boolean;
  /** Short reason shown under a disabled option. */
  reason?: string;
}

/** Case-insensitive search: the query can match anywhere in the label or in any keyword. */
export function filterOptions(options: Option[], query: string): Option[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => [o.label, ...(o.keywords ?? [])].some((t) => t.toLowerCase().includes(q)));
}

/** The drawing for a dress worn by this service and gender, if there is one. */
export function uniformFor(
  uniforms: Uniform[],
  dress: string | null,
  service: string | null,
  gender: string | null,
): Uniform | null {
  if (!dress || !service || !gender) return null;
  return uniforms.find((u) => u.dress === dress && u.services.includes(service) && u.genders.includes(gender)) ?? null;
}

/** Services as dropdown lines. */
export const serviceOptions = (options: Options): Option[] => options.services.map((s) => ({ id: s.id, label: s.name }));
/** Genders as dropdown lines. */
export const genderOptions = (options: Options): Option[] => options.genders.map((g) => ({ id: g.id, label: g.name }));

/** Every dress, disabled when it is not drawn for this service and gender (or they are not picked yet). */
export function dressOptions(
  options: Options,
  uniforms: Uniform[],
  service: string | null,
  gender: string | null,
): Option[] {
  return options.dresses.map((d) => {
    if (!service || !gender) return { id: d.id, label: d.name, disabled: true, reason: 'Pick a service and gender first' };
    if (!uniformFor(uniforms, d.id, service, gender)) return { id: d.id, label: d.name, disabled: true, reason: 'Not drawn yet' };
    return { id: d.id, label: d.name };
  });
}

/** Ranks, in the order of options.rank.categories and then file order. The same for every service. */
export function rankOptions(badges: Badge[], options: Options): Option[] {
  const seen = new Set<string>();
  const out: Option[] = [];
  for (const category of options.rank.categories) {
    for (const b of badges) {
      if (b.category !== category || !b.rank || seen.has(b.rank)) continue;
      seen.add(b.rank);
      out.push({ id: b.rank, label: b.name, keywords: [b.rank] });
    }
  }
  return out;
}

/** Branches: the arms badges. The same for every service. */
export function branchOptions(badges: Badge[], options: Options): Option[] {
  return badges.filter((b) => b.category === options.branch.category).map((b) => ({ id: b.slug, label: b.name }));
}

/** true when this uniform has a spot for the branch (collar) badge. */
export function branchWorn(uniform: Uniform | null, options: Options): boolean {
  return !!uniform && uniform.anchors.some((a) => a.accepts.includes(options.branch.category));
}

/** Drops every choice that is no longer valid, e.g. the dress after a change of service or gender. */
export function sanitizeSelection(sel: Selection, uniforms: Uniform[], badges: Badge[], options: Options): Selection {
  const service = options.services.some((s) => s.id === sel.service) ? sel.service : null;
  const gender = options.genders.some((g) => g.id === sel.gender) ? sel.gender : null;
  const dress = uniformFor(uniforms, sel.dress, service, gender) ? sel.dress : null;
  const rank = rankOptions(badges, options).some((r) => r.id === sel.rank) ? sel.rank : null;
  const branch = branchOptions(badges, options).some((b) => b.id === sel.branch) ? sel.branch : null;
  return { service, gender, dress, rank, branch };
}

/** The name of the first field that still needs a pick, or null when Create can go ahead. */
export function missingField(sel: Selection, uniform: Uniform | null, options: Options): string | null {
  if (!sel.service) return 'Service';
  if (!sel.gender) return 'Gender';
  if (!sel.dress || !uniform) return 'Uniform';
  if (!sel.rank) return 'Rank';
  if (branchWorn(uniform, options) && !sel.branch) return 'Branch';
  return null;
}

/** The items a rank implies, from the data: its board, insignia and gorget, plus the plain board whose `usedBy` lists it. */
export function itemsForRank(rank: string, badges: Badge[], options: Options): Badge[] {
  const ranked = (b: Badge) =>
    b.rank === rank && (options.rank.categories.includes(b.category) || options.rank.replacesBranch.includes(b.category));
  const items = badges.filter((b) => ranked(b) || b.usedBy?.includes(rank));
  const order = [...options.rank.categories, ...options.rank.replacesBranch];
  return items.sort((a, b) => order.indexOf(b.category) - order.indexOf(a.category)); // boards before insignia
}

export interface Loadout {
  /** What is worn because of the selection, already checked against the placement rules. */
  badges: Badge[];
  /** Things the selection asks for that this uniform cannot show, in words. */
  notes: string[];
}

/**
 * Turns a selection into the badges worn on its uniform: the rank's board and insignia, and the branch badge.
 * A gorget takes the place of the branch badge. Anything the placement rules refuse (no spot on this
 * uniform) is left out and explained in `notes`.
 */
export function loadoutFor(
  sel: Selection,
  uniform: Uniform,
  badges: Badge[],
  categories: Category[],
  options: Options,
): Loadout {
  const candidates = sel.rank ? itemsForRank(sel.rank, badges, options) : [];
  const replacing = candidates.find((b) => options.rank.replacesBranch.includes(b.category));
  const branch = badges.find((b) => b.category === options.branch.category && b.slug === sel.branch);
  const notes: string[] = [];
  if (branch && branchWorn(uniform, options)) {
    if (replacing) notes.push(`The ${replacing.name} gorget is worn in place of the ${branch.name} badge.`);
    else candidates.push(branch);
  }
  return placeAll(uniform, candidates, categories, notes);
}

/** Places each candidate in turn. What the placement rules refuse is left out and explained in `notes`. */
function placeAll(uniform: Uniform, candidates: Badge[], categories: Category[], notes: string[]): Loadout {
  let placed: Badge[] = [];
  for (const badge of candidates) {
    const r = placeBadge(uniform, badge, placed, categories);
    if (r.ok) placed = r.placed;
    else notes.push(`${badge.name} (${categories.find((c) => c.id === badge.category)?.name ?? badge.category}) is not shown on ${uniform.name}. ${r.reason}`);
  }
  return { badges: placed, notes };
}

/** One line for the top bar: "Army · Male · No. 1 · 2LT Second Lieutenant · Infantry". */
export function describeSelection(sel: Selection, badges: Badge[], options: Options): string {
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;
  return [
    name(options.services, sel.service),
    name(options.genders, sel.gender),
    name(options.dresses, sel.dress),
    rankOptions(badges, options).find((r) => r.id === sel.rank)?.label,
    branchOptions(badges, options).find((b) => b.id === sel.branch)?.label,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Reads a saved selection. Anything unreadable gives an empty one. */
export function parseSelection(raw: string | null): Selection {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data !== 'object' || data === null) return { ...EMPTY_SELECTION };
    const field = (k: keyof Selection): string | null => {
      const v = (data as Record<string, unknown>)[k];
      return typeof v === 'string' ? v : null;
    };
    return { service: field('service'), gender: field('gender'), dress: field('dress'), rank: field('rank'), branch: field('branch') };
  } catch {
    return { ...EMPTY_SELECTION };
  }
}
