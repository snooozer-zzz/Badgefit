import { useState } from 'react';
import type { Badge } from '../data/schema';
import { assetUrl, badgeArtPath, initials } from '../lib/assets';

/** Placeholder drawn in code, used until redrawn art exists for a badge. */
export function PlaceholderBadge({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`${name} (art needed)`} className="placeholder">
      <circle cx="50" cy="50" r="44" fill="#2a2f35" stroke="#8a929b" strokeWidth="3" strokeDasharray="7 5" />
      <text x="50" y="58" textAnchor="middle" fontSize="26" fontWeight="700" fill="#c9ced4">
        {initials(name)}
      </text>
    </svg>
  );
}

/** Library tile art: the redrawn PNG if there is one, otherwise the placeholder. */
export function BadgeImage({ badge }: { badge: Badge }) {
  const [failed, setFailed] = useState(false);
  if (badge.status === 'todo' || failed) return <PlaceholderBadge name={badge.name} />;
  return (
    <img
      src={assetUrl(badgeArtPath(badge))}
      alt={badge.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Same thing, but as an SVG <image> so it can sit on the uniform. The art is a square PNG: in a square
 * box it is shown whole, in a taller, narrower box (medals) only the middle strip, from the top, is shown.
 */
export function BadgeOnUniform({
  badge,
  artPath,
  x,
  y,
  width,
  height,
}: {
  badge: Badge;
  /** The art file under public/, from resolveBadgeArt (shared art unless the service or uniform has its own). */
  artPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  if (badge.status === 'todo' || failed) {
    return (
      <svg x={x} y={y} width={width} height={height} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="#2a2f35" stroke="#e2c045" strokeWidth="5" />
        <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="700" fill="#f1e3a6">
          {initials(badge.name)}
        </text>
      </svg>
    );
  }
  return (
    <image
      href={assetUrl(artPath)}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMin slice"
      onError={() => setFailed(true)}
    />
  );
}
