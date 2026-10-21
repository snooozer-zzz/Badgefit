// Ribbon bars: a medal drawn as just its ribbon. Holds the ribbon box size and the crop of the medal art.
import type { Anchor, Badge } from '../data/schema';

/** The medal PNGs are 512 px square, with the medal in the middle strip. */
export const ART_PX = 512;

/** What a ribbon anchor draws when it does not say: 17.6 x 12 mm, three to a row. */
const DEFAULT_RIBBON = { widthMm: 17.6, heightMm: 12, perRow: 3 };

/** The ribbon box and row length of an anchor in ribbon mode. */
export function ribbonSpec(anchor: Pick<Anchor, 'ribbon'>): { widthMm: number; heightMm: number; perRow: number } {
  return {
    widthMm: anchor.ribbon?.widthMm ?? DEFAULT_RIBBON.widthMm,
    heightMm: anchor.ribbon?.heightMm ?? DEFAULT_RIBBON.heightMm,
    perRow: anchor.ribbon?.perRow ?? DEFAULT_RIBBON.perRow,
  };
}

/**
 * The part of a medal's art that is its ribbon, in art pixels. Measured once per medal and kept in badges.json
 * (`ribbon`); a medal without it gets the top band of its middle strip (rows 5% to 33%), so a new medal still shows.
 */
export function ribbonCrop(badge: Pick<Badge, 'widthMm' | 'heightMm' | 'ribbon'>): { x: number; y: number; width: number; height: number } {
  if (badge.ribbon) return badge.ribbon;
  const strip = Math.min(ART_PX, (ART_PX * badge.widthMm) / (badge.heightMm ?? badge.widthMm));
  return { x: (ART_PX - strip) / 2, y: ART_PX * 0.05, width: strip, height: ART_PX * 0.28 };
}
