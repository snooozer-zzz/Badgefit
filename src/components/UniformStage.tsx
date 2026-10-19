import type { PlacedBox } from '../lib/placement';
import type { Badge, Uniform } from '../data/schema';
import { assetUrl } from '../lib/assets';
import { BadgeOnUniform } from './BadgeArt';

interface Props {
  uniform: Uniform;
  boxes: PlacedBox[];
  showAnchors: boolean;
  /** Anchor to emphasise, e.g. while hovering a badge in the library. */
  highlightAnchorId: string | null;
  onRemove: (badge: Badge) => void;
}

export function UniformStage({ uniform, boxes, showAnchors, highlightAnchorId, onRemove }: Props) {
  return (
    <svg
      className="stage"
      viewBox={`0 0 ${uniform.width} ${uniform.height}`}
      role="img"
      aria-label={`${uniform.name} with badges`}
    >
      <image href={assetUrl(uniform.image)} x={0} y={0} width={uniform.width} height={uniform.height} />

      {(showAnchors || highlightAnchorId) &&
        uniform.anchors.map((a) => {
          const active = a.id === highlightAnchorId;
          if (!showAnchors && !active) return null;
          return (
            <g key={a.id} className={active ? 'anchor active' : 'anchor'} pointerEvents="none">
              <circle cx={a.x} cy={a.y} r={active ? 20 : 13} />
              <text x={a.x} y={a.y - (active ? 28 : 20)} textAnchor="middle">
                {a.label}
              </text>
            </g>
          );
        })}

      {boxes.map(({ badge, x, y, size }) => (
        <g
          key={`${badge.category}/${badge.slug}`}
          className="placed"
          onClick={() => onRemove(badge)}
          tabIndex={0}
          role="button"
          aria-label={`Remove ${badge.name}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRemove(badge);
            }
          }}
        >
          <title>{`${badge.name} (click to remove)`}</title>
          <BadgeOnUniform badge={badge} x={x} y={y} size={size} />
        </g>
      ))}
    </svg>
  );
}
