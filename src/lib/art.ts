// Picks which art file to draw: a badge can have its own art per service/dress/uniform, and a uniform can
// have its own perspective sprites per service.
import type { Badge, Mounted } from '../data/schema';
import { badgeArtPath } from './assets';

/** Which service, dress and uniform the art is wanted for. Any can be left out (e.g. the library has no uniform). */
export interface ArtContext {
  service?: string | null;
  dress?: string | null;
  uniform?: string | null;
}

/**
 * The art file for a badge worn by this service on this uniform. A badge can list `artVariants`; the most
 * specific one that matches wins (a uniform scores 2, a dress 2 and a service 1, added up). With none, it is the shared
 * art at public/badges/<category>/<slug>.png, which is what every badge uses today.
 */
export function resolveBadgeArt(badge: Badge, ctx: ArtContext = {}): string {
  let best: { path: string; score: number } | null = null;
  for (const v of badge.artVariants ?? []) {
    if (v.service !== undefined && v.service !== ctx.service) continue;
    if (v.dress !== undefined && v.dress !== ctx.dress) continue;
    if (v.uniform !== undefined && v.uniform !== ctx.uniform) continue;
    const score = (v.uniform !== undefined ? 2 : 0) + (v.dress !== undefined ? 2 : 0) + (v.service !== undefined ? 1 : 0);
    if (!best || score > best.score) best = { path: v.path, score };
  }
  return best ? best.path : badgeArtPath(badge);
}

/**
 * The perspective sprites for a uniform and service: a file made for that service if there is one, otherwise
 * the shared file of the uniform, otherwise null (items are then drawn flat on their spot).
 *
 * With a dress, a file made for that dress and service (or for that dress alone) goes on top: the items it holds
 * (the sleeve rank in that service's colours) replace the same items of the file chosen above.
 */
export function resolveMounted(list: Mounted[], uniformId: string, service?: string | null, dress?: string | null): Mounted | null {
  const ofUniform = list.filter((m) => m.uniform === uniformId);
  const whole = ofUniform.filter((m) => m.dress === undefined);
  const base =
    whole.find((m) => m.service !== undefined && m.service === service) ?? whole.find((m) => m.service === undefined) ?? null;
  if (!dress) return base;
  const overlay =
    ofUniform.find((m) => m.dress === dress && m.service !== undefined && m.service === service) ??
    ofUniform.find((m) => m.dress === dress && m.service === undefined);
  if (!overlay) return base;
  return base ? { ...base, items: { ...base.items, ...overlay.items } } : overlay;
}
