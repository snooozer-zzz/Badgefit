// Zoom and drag for the uniform picture: mouse wheel and buttons zoom, dragging moves the picture.
// UniformStage uses it; the picture itself is drawn there.
import { useCallback, useEffect, useRef, useState } from 'react';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
const DRAG_THRESHOLD_PX = 4;

/** Zoom level plus the centre of the visible window, in uniform image pixels. */
export interface View {
  z: number;
  cx: number;
  cy: number;
}

/** Keeps a number between a lowest and a highest value. */
const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n));

/** Zoom and drag state for a picture that is `width` x `height` image pixels. */
export function useZoomPan(width: number, height: number) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ z: 1, cx: width / 2, cy: height / 2 });
  const viewRef = useRef(view); // the latest view, for handlers that must not wait for a re-render
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  // Shows a view, kept inside the limits: not zoomed out past 1 and not panned off the picture.
  const showView = useCallback(
    (next: View) => {
      const z = clamp(next.z, MIN_ZOOM, MAX_ZOOM);
      const halfWidth = width / (2 * z);
      const halfHeight = height / (2 * z);
      const v = {
        z,
        cx: clamp(next.cx, halfWidth, width - halfWidth),
        cy: clamp(next.cy, halfHeight, height - halfHeight),
      };
      viewRef.current = v;
      setView(v);
    },
    [width, height],
  );

  // Zooms by `factor`, keeping the picture point under (clientX, clientY) where it is. Without a point it zooms on the centre.
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const v = viewRef.current;
      const z = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
      let px = v.cx;
      let py = v.cy;
      const ctm = svgRef.current?.getScreenCTM();
      if (ctm && clientX !== undefined && clientY !== undefined) {
        const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
        px = point.x;
        py = point.y;
      }
      // The top-left corner of the new window, so that (px, py) stays at the same place on screen.
      const left = px - (px - (v.cx - width / (2 * v.z))) * (v.z / z);
      const top = py - (py - (v.cy - height / (2 * v.z))) * (v.z / z);
      showView({ z, cx: left + width / (2 * z), cy: top + height / (2 * z) });
    },
    [showView, width, height],
  );

  // React's onWheel cannot stop the page scrolling, so the wheel needs a listener of its own.
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

  // Mouse or finger goes down: a drag may start.
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  // Pointer moves: once it has moved a few pixels it is a drag, and the picture follows it.
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
    showView({ ...v, cx: v.cx - dx / ctm.a, cy: v.cy - dy / ctm.d });
  };

  // Pointer goes up or is cancelled: the drag is over.
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  // The click that ends a drag is swallowed, so dragging over a badge does not remove it.
  const onClickCapture = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!suppressClick.current) return;
    e.stopPropagation();
    suppressClick.current = false;
  };

  const reset = () => showView({ z: 1, cx: width / 2, cy: height / 2 });

  return {
    svgRef,
    view,
    dragging,
    zoomAt,
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onClickCapture },
  };
}
