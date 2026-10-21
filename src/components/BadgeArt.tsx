// How one badge is drawn: as a tile in the library, as flat art on the uniform, or as a ribbon on the uniform.
// Until a badge has redrawn art (or if its picture fails to load) a placeholder circle with initials is shown.
import { useState } from 'react';
import type { Badge } from '../data/schema';
import { assetUrl, badgeArtPath, initials } from '../lib/assets';
import { ART_PX, ribbonCrop } from '../lib/ribbon';

/** Placeholder for a library tile, drawn in code. */
function PlaceholderBadge({ name }: { name: string }) {
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
  return <img src={assetUrl(badgeArtPath(badge))} alt={badge.name} loading="lazy" onError={() => setFailed(true)} />;
}

/** What the two on-uniform pieces need: the badge, its art file and the box to draw it in (image pixels). */
interface OnUniformProps {
  badge: Badge;
  /** The art file under public/, from resolveBadgeArt (shared art unless the service or uniform has its own). */
  artPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Flat badge art as an SVG <image> that sits on the uniform. The art is a square PNG: in a square box it is
 * shown whole, in a taller, narrower box (medals) only the middle strip, from the top, is shown.
 */
export function BadgeOnUniform({ badge, artPath, x, y, width, height }: OnUniformProps) {
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

/**
 * Only the ribbon of a medal, for a ribbon bar. The ribbon rectangle of the medal's art (badge.ribbon, in art
 * pixels) is cut out with a nested <svg> viewBox and stretched into the box, so no new image file is needed.
 * A 1 px dark outline goes round each ribbon.
 */
export function RibbonOnUniform({ badge, artPath, x, y, width, height }: OnUniformProps) {
  const [failed, setFailed] = useState(false);
  const crop = ribbonCrop(badge);
  const missing = badge.status === 'todo' || failed;
  return (
    <>
      {missing ? (
        <rect x={x} y={y} width={width} height={height} fill="#2a2f35" />
      ) : (
        <svg x={x} y={y} width={width} height={height} viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`} preserveAspectRatio="none">
          <image href={assetUrl(artPath)} x={0} y={0} width={ART_PX} height={ART_PX} onError={() => setFailed(true)} />
        </svg>
      )}
      <rect x={x + 0.5} y={y + 0.5} width={width - 1} height={height - 1} fill="none" stroke="#3c3c3c" strokeWidth={1} />
    </>
  );
}
