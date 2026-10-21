// Draws the uniform picture with the worn badges on it. You can zoom, drag, and click a badge to remove it.
import type { PlacedBox } from '../lib/layout';
import type { Badge, Mounted, Uniform } from '../data/schema';
import { assetUrl } from '../lib/assets';
import { resolveBadgeArt } from '../lib/art';
import { badgeKey } from '../lib/placement';
import { BadgeOnUniform, RibbonOnUniform } from './BadgeArt';
import { MAX_ZOOM, MIN_ZOOM, useZoomPan } from './useZoomPan';

interface Props {
  uniform: Uniform;
  boxes: PlacedBox[];
  /** Perspective sprites for this uniform: items on shoulders, sleeves and collar are drawn from these. */
  mounted: Mounted | null;
  /** The service whose art to draw (shared art unless a badge has art for this service). */
  service: string | null;
  /** Keys of the badges that come from the selection screen: clicking them does not remove them. */
  lockedKeys: Set<string>;
  showAnchors: boolean;
  /** Anchor to emphasise, e.g. while hovering a badge in the library. */
  highlightAnchorId: string | null;
  onRemove: (badge: Badge) => void;
}

/** The uniform picture, its placement-spot markers, the worn badges and the zoom buttons. */
export function UniformStage({ uniform, boxes, mounted, service, lockedKeys, showAnchors, highlightAnchorId, onRemove }: Props) {
  const { svgRef, view, dragging, zoomAt, reset, handlers } = useZoomPan(uniform.width, uniform.height);
  const zoomed = view.z > MIN_ZOOM;
  const visibleWidth = uniform.width / view.z;
  const visibleHeight = uniform.height / view.z;
  const className = dragging ? 'stage dragging' : zoomed ? 'stage zoomed' : 'stage';

  return (
    <div className="stage-frame">
      <svg
        ref={svgRef}
        className={className}
        viewBox={`${view.cx - visibleWidth / 2} ${view.cy - visibleHeight / 2} ${visibleWidth} ${visibleHeight}`}
        role="img"
        aria-label={`${uniform.name} with badges`}
        {...handlers}
      >
        <image href={assetUrl(uniform.image)} x={0} y={0} width={uniform.width} height={uniform.height} />

        <AnchorMarkers uniform={uniform} showAll={showAnchors} highlightId={highlightAnchorId} />

        {boxes.map((box) => {
          const key = badgeKey(box.badge);
          return (
            <PlacedBadge
              key={`${key}/${box.side}`}
              box={box}
              uniform={uniform}
              mounted={mounted}
              service={service}
              locked={lockedKeys.has(key)}
              onRemove={onRemove}
            />
          );
        })}
      </svg>

      <div className="zoom-controls" role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoomAt(1.5)} disabled={view.z >= MAX_ZOOM} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomAt(1 / 1.5)} disabled={!zoomed} aria-label="Zoom out">−</button>
        <button type="button" onClick={reset} disabled={!zoomed} aria-label="Reset zoom">⟲</button>
      </div>
    </div>
  );
}

/** Circles and labels for the placement spots: all of them, or only the highlighted one. */
function AnchorMarkers({ uniform, showAll, highlightId }: { uniform: Uniform; showAll: boolean; highlightId: string | null }) {
  return (
    <>
      {uniform.anchors.map((a) => {
        const active = a.id === highlightId;
        if (!showAll && !active) return null;
        return (
          <g key={a.id} className={active ? 'anchor active' : 'anchor'} pointerEvents="none">
            <circle cx={a.x} cy={a.y} r={active ? 20 : 13} />
            <text x={a.x} y={a.y - (active ? 28 : 20)} textAnchor="middle">
              {a.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

interface PlacedBadgeProps {
  box: PlacedBox;
  uniform: Uniform;
  mounted: Mounted | null;
  service: string | null;
  locked: boolean;
  onRemove: (badge: Badge) => void;
}

/** One worn badge: drawn from its perspective sprites, as a ribbon, or as flat art. Click or Enter removes it. */
function PlacedBadge({ box, uniform, mounted, service, locked, onRemove }: PlacedBadgeProps) {
  const { badge, anchor, slot, x, y, width, height, rotation, render } = box;
  // Perspective sprites only where the spot is on a shaped part of the uniform: a ribbon, or a spot marked flat, uses the flat art.
  const slots = render === 'ribbon' || anchor.flat ? undefined : mounted?.items[badgeKey(badge)];
  const sprites = slots ? slots[Math.min(slot, slots.length - 1)] : null;
  const artPath = resolveBadgeArt(badge, { service, dress: uniform.dress, uniform: uniform.id });
  const label = locked ? `${badge.name} (part of your selection)` : `Remove ${badge.name}`;

  return (
    <g
      className={locked ? 'placed locked' : 'placed'}
      transform={rotation ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})` : undefined}
      onClick={() => onRemove(badge)}
      tabIndex={0}
      role="button"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRemove(badge);
        }
      }}
    >
      <title>{locked ? label : `${badge.name} (click to remove)`}</title>
      {sprites ? (
        sprites.map((s) => <image key={s.href} href={assetUrl(s.href)} x={s.x} y={s.y} width={s.width} height={s.height} />)
      ) : render === 'ribbon' ? (
        <RibbonOnUniform badge={badge} artPath={artPath} x={x} y={y} width={width} height={height} />
      ) : (
        <BadgeOnUniform badge={badge} artPath={artPath} x={x} y={y} width={width} height={height} />
      )}
    </g>
  );
}
