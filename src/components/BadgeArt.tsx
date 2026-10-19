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

/** Same thing, but as an SVG <image> so it can sit on the uniform. */
export function BadgeOnUniform({
  badge,
  x,
  y,
  size,
}: {
  badge: Badge;
  x: number;
  y: number;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (badge.status === 'todo' || failed) {
    return (
      <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="#2a2f35" stroke="#e2c045" strokeWidth="5" />
        <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="700" fill="#f1e3a6">
          {initials(badge.name)}
        </text>
      </svg>
    );
  }
  return (
    <image
      href={assetUrl(badgeArtPath(badge))}
      x={x}
      y={y}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      onError={() => setFailed(true)}
    />
  );
}
