// Tests for choosing the art file of a badge and the perspective sprites of a uniform (art.ts).
import { describe, expect, it } from 'vitest';
import type { Badge, Mounted } from '../data/schema';
import { resolveBadgeArt, resolveMounted } from './art';

/** Makes a shoulder board badge for a test. */
const board = (extra: Partial<Badge> = {}): Badge => ({
  slug: '2lt',
  name: '2LT Second Lieutenant',
  category: 'shoulder-boards',
  status: 'redrawn',
  widthMm: 55,
  sizeVerified: false,
  ...extra,
});

describe('resolveBadgeArt', () => {
  it('uses the shared art when a badge has no variants (every badge today)', () => {
    expect(resolveBadgeArt(board())).toBe('badges/shoulder-boards/2lt.png');
    expect(resolveBadgeArt(board(), { service: 'rsaf', uniform: 'number-1' })).toBe('badges/shoulder-boards/2lt.png');
  });

  it('uses the shared art when no variant matches the service or uniform', () => {
    const b = board({ artVariants: [{ service: 'rsn', path: 'badges/shoulder-boards/rsn/2lt.png' }] });
    expect(resolveBadgeArt(b, { service: 'army', uniform: 'number-1' })).toBe('badges/shoulder-boards/2lt.png');
    expect(resolveBadgeArt(b, {})).toBe('badges/shoulder-boards/2lt.png');
  });

  it('uses art made for a service, for that service only', () => {
    const b = board({ artVariants: [{ service: 'rsaf', path: 'a.png' }] });
    expect(resolveBadgeArt(b, { service: 'rsaf', uniform: 'number-1' })).toBe('a.png');
    expect(resolveBadgeArt(b, { service: 'army', uniform: 'number-1' })).toBe('badges/shoulder-boards/2lt.png');
  });

  it('uses art made for a uniform, whatever the service', () => {
    const b = board({ artVariants: [{ uniform: 'number-2-rsn-male', path: 'u.png' }] });
    expect(resolveBadgeArt(b, { service: 'rsn', uniform: 'number-2-rsn-male' })).toBe('u.png');
    expect(resolveBadgeArt(b, { service: 'rsn', uniform: 'number-1' })).toBe('badges/shoulder-boards/2lt.png');
  });

  it('uses art made for a dress, on every uniform of that dress (the silver arms badges)', () => {
    const b = board({ artVariants: [{ dress: 'number-2', path: 'silver.png' }] });
    expect(resolveBadgeArt(b, { service: 'army', dress: 'number-2', uniform: 'number-2-army-male' })).toBe('silver.png');
    expect(resolveBadgeArt(b, { service: 'army', dress: 'number-2', uniform: 'number-2-army-female' })).toBe('silver.png');
    expect(resolveBadgeArt(b, { service: 'army', dress: 'number-1', uniform: 'number-1' })).toBe('badges/shoulder-boards/2lt.png');
    expect(resolveBadgeArt(b, {})).toBe('badges/shoulder-boards/2lt.png');
  });

  it('prefers the most specific variant: uniform and service, then uniform, then service', () => {
    const b = board({
      artVariants: [
        { service: 'rsaf', path: 'service.png' },
        { uniform: 'number-1', path: 'uniform.png' },
        { service: 'rsaf', uniform: 'number-1', path: 'both.png' },
      ],
    });
    expect(resolveBadgeArt(b, { service: 'rsaf', uniform: 'number-1' })).toBe('both.png');
    expect(resolveBadgeArt(b, { service: 'army', uniform: 'number-1' })).toBe('uniform.png');
    expect(resolveBadgeArt(b, { service: 'rsaf', uniform: 'number-5-rsaf-male' })).toBe('service.png');
  });
});

describe('resolveMounted', () => {
  const sprites = (uniform: string, service?: string): Mounted => ({ uniform, service, items: {} });
  const shared = sprites('number-1');
  const rsaf = sprites('number-1', 'rsaf');

  it('shares the sprites of a uniform between every service (the only case today)', () => {
    for (const service of ['army', 'rsaf', 'rsn', null, undefined]) expect(resolveMounted([shared], 'number-1', service)).toBe(shared);
  });

  it('uses the sprites made for a service for that service, and the shared ones for the rest', () => {
    expect(resolveMounted([shared, rsaf], 'number-1', 'rsaf')).toBe(rsaf);
    expect(resolveMounted([rsaf, shared], 'number-1', 'army')).toBe(shared);
  });

  it('puts the sleeve rank made for a dress and service on top of the uniform sprites, keeping the rest', () => {
    const sprite = (href: string) => [[{ href, x: 0, y: 0, width: 1, height: 1 }]];
    const own: Mounted = { uniform: 'number-1', items: { 'rank-insignia/pfc': sprite('army.png'), 'shoulder-boards/2lt': sprite('board.png') } };
    const rsnNo5: Mounted = { uniform: 'number-1', service: 'rsn', dress: 'number-5', items: { 'rank-insignia/pfc': sprite('rsn-no5.png') } };
    const list = [own, rsnNo5];
    const worn = resolveMounted(list, 'number-1', 'rsn', 'number-5');
    expect(worn?.items['rank-insignia/pfc']).toEqual(sprite('rsn-no5.png'));
    expect(worn?.items['shoulder-boards/2lt']).toEqual(sprite('board.png'));
    // another service, another dress, or no dress: the uniform's own sprites, untouched
    expect(resolveMounted(list, 'number-1', 'army', 'number-5')).toBe(own);
    expect(resolveMounted(list, 'number-1', 'rsn', 'number-1')).toBe(own);
    expect(resolveMounted(list, 'number-1', 'rsn')).toBe(own);
  });

  it('never takes a dress file for the uniform sprites of a service', () => {
    const dressOnly: Mounted = { uniform: 'number-1', service: 'rsn', dress: 'number-5', items: {} };
    expect(resolveMounted([dressOnly], 'number-1', 'rsn')).toBeNull();
  });

  it('gives nothing for a uniform without sprites, so items are drawn flat', () => {
    expect(resolveMounted([shared], 'number-2-army-male', 'army')).toBeNull();
    expect(resolveMounted([rsaf], 'number-1', 'army')).toBeNull();
  });
});
