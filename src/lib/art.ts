import type { Badge, Mounted } from '../data/schema';
import { badgeArtPath } from './assets';

/** Which service and uniform the art is wanted for. Either can be left out (e.g. the library has no uniform). */
export interface ArtContext {
  service?: string | null;
  uniform?: string | null;
}

/**
 * The art file for a badge worn by this service on this uniform. A badge can list `artVariants`; the most
 * specific one that matches wins (uniform and service, then uniform, then service). With none, it is the shared
 * art at public/badges/<category>/<slug>.png, which is what every badge uses today.
 */
export function resolveBadgeArt(badge: Badge, ctx: ArtContext = {}): string {
  let best: { path: string; score: number } | null = null;
  for (const v of badge.artVariants ?? []) {
    if (v.service !== undefined && v.service !== ctx.service) continue;
    if (v.uniform !== undefined && v.uniform !== ctx.uniform) continue;
    const score = (v.uniform !== undefined ? 2 : 0) + (v.service !== undefined ? 1 : 0);
    if (!best || score > best.score) best = { path: v.path, score };
  }
  return best ? best.path : badgeArtPath(badge);
}

/**
 * The perspective sprites for a uniform and service: a file made for that service if there is one, otherwise
 * the shared file of the uniform, otherwise null (items are then drawn flat on their spot).
 */
export function resolveMounted(list: Mounted[], uniformId: string, service?: string | null): Mounted | null {
  const ofUniform = list.filter((m) => m.uniform === uniformId);
  return (
    ofUniform.find((m) => m.service !== undefined && m.service === service) ??
    ofUniform.find((m) => m.service === undefined) ??
    null
  );
}
