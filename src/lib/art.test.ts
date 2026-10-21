import { describe, expect, it } from 'vitest';
import type { Badge, Mounted } from '../data/schema';
import { resolveBadgeArt, resolveMounted } from './art';

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

  it('gives nothing for a uniform without sprites, so items are drawn flat', () => {
    expect(resolveMounted([shared], 'number-2-army-male', 'army')).toBeNull();
    expect(resolveMounted([rsaf], 'number-1', 'army')).toBeNull();
  });
});
