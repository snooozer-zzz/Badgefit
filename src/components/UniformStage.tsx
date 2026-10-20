import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlacedBox } from '../lib/placement';
import type { Badge, Mounted, Uniform } from '../data/schema';
import { assetUrl } from '../lib/assets';
import { resolveBadgeArt } from '../lib/art';
import { BadgeOnUniform } from './BadgeArt';

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

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const DRAG_THRESHOLD_PX = 4;

/** Zoom level plus the centre of the visible window, in uniform image pixels. */
interface View {
  z: number;
  cx: number;
  cy: number;
}

export function UniformStage({ uniform, boxes, mounted, service, lockedKeys, showAnchors, highlightAnchorId, onRemove }: Props) {
  const { width: W, height: H } = uniform;
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ z: 1, cx: W / 2, cy: H / 2 });
  const viewRef = useRef(view);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  const apply = useCallback(
    (next: View) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next.z));
      const hw = W / (2 * z);
      const hh = H / (2 * z);
      const v = {
        z,
        cx: Math.min(W - hw, Math.max(hw, next.cx)),
        cy: Math.min(H - hh, Math.max(hh, next.cy)),
      };
      viewRef.current = v;
      setView(v);
    },
    [W, H],
  );

  /** Zoom by `factor`, keeping the uniform point at (clientX, clientY) under the cursor. */
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const svg = svgRef.current;
      const v = viewRef.current;
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      let px = v.cx;
      let py = v.cy;
      const ctm = svg?.getScreenCTM();
      if (svg && ctm && clientX !== undefined && clientY !== undefined) {
        const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
        px = pt.x;
        py = pt.y;
      }
      // Origin of the new window so that (px, py) stays at the same place on screen.
      const ox = px - (px - (v.cx - W / (2 * v.z))) * (v.z / z);
      const oy = py - (py - (v.cy - H / (2 * v.z))) * (v.z / z);
      apply({ z, cx: ox + W / (2 * z), cy: oy + H / (2 * z) });
    },
    [apply, W, H],
  );

  // React's onWheel is passive, so preventDefault (stop the page scrolling) needs a native listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const ctm = svgRef.current?.getScreenCTM();
    if (!d || !ctm) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      suppressClick.current = true; // a drag must not count as a click on a placed badge
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    d.x = e.clientX;
    d.y = e.clientY;
    const v = viewRef.current;
    apply({ ...v, cx: v.cx - dx / ctm.a, cy: v.cy - dy / ctm.d });
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const zoomed = view.z > MIN_ZOOM;
  const vw = W / view.z;
  const vh = H / view.z;

  return (
    <div className="stage-frame">
    <svg
      ref={svgRef}
      className={dragging ? 'stage dragging' : zoomed ? 'stage zoomed' : 'stage'}
      viewBox={`${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`}
      role="img"
      aria-label={`${uniform.name} with badges`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}
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

      {boxes.map(({ badge, slot, side, x, y, width, height, rotation }) => {
        const key = `${badge.category}/${badge.slug}`;
        const locked = lockedKeys.has(key);
        const slots = mounted?.items[key];
        const sprites = slots ? slots[Math.min(slot, slots.length - 1)] : null;
        return (
          <g
            key={`${key}/${side}`}
            className={locked ? 'placed locked' : 'placed'}
            transform={rotation ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})` : undefined}
            onClick={() => onRemove(badge)}
            tabIndex={0}
            role="button"
            aria-label={locked ? `${badge.name} (part of your selection)` : `Remove ${badge.name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRemove(badge);
              }
            }}
          >
            <title>{locked ? `${badge.name} (part of your selection)` : `${badge.name} (click to remove)`}</title>
            {sprites ? (
              sprites.map((s) => (
                <image key={s.href} href={assetUrl(s.href)} x={s.x} y={s.y} width={s.width} height={s.height} />
              ))
            ) : (
              <BadgeOnUniform badge={badge} artPath={resolveBadgeArt(badge, { service, uniform: uniform.id })} x={x} y={y} width={width} height={height} />
            )}
          </g>
        );
      })}
    </svg>
    <div className="zoom-controls" role="group" aria-label="Zoom">
      <button type="button" onClick={() => zoomAt(1.5)} disabled={view.z >= MAX_ZOOM} aria-label="Zoom in">+</button>
      <button type="button" onClick={() => zoomAt(1 / 1.5)} disabled={!zoomed} aria-label="Zoom out">−</button>
      <button type="button" onClick={() => apply({ z: 1, cx: W / 2, cy: H / 2 })} disabled={!zoomed} aria-label="Reset zoom">⟲</button>
    </div>
    </div>
  );
}
