import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";

/**
 * Fired on `window` the moment a two-finger canvas gesture begins, so any
 * in-flight single-pointer gesture (marquee, reparent drag) can cancel
 * itself cleanly before the pan/pinch takes over.
 */
export const TOUCH_GESTURE_START_EVENT = "protota:touch-gesture-start";

interface Point {
  x: number;
  y: number;
}

interface UseTouchPanZoomOptions {
  /** The clipping canvas element that receives the pointer events. */
  canvasRef: RefObject<HTMLDivElement | null>;
  /** The transformed surface (transform-origin `50% 0`, laid out with `safe center`). */
  surfaceRef: RefObject<HTMLDivElement | null>;
  zoomRef: MutableRefObject<number>;
  panRef: MutableRefObject<Point>;
  setPan: (pan: Point) => void;
  setZoom: (zoom: number) => void;
  minZoom: number;
  maxZoom: number;
}

interface GestureBaseline {
  zoom: number;
  /** Two-finger start distance (px, clamped away from zero). */
  dist: number;
  /** Surface-local coords of the world point under the gesture midpoint. */
  u: number;
  v: number;
  /** Canvas rect origin at gesture start (the canvas does not move mid-gesture). */
  rectLeft: number;
  rectTop: number;
  /** Surface layout position (untransformed), for the `50% 0` origin math. */
  surfLeft: number;
  surfHalfW: number;
}

/**
 * Two-finger pan + pinch zoom for the viewport canvas, tracked via pointer
 * events with a small touch-pointer registry. Single-pointer touch
 * interactions (tap-select, marquee, reparent drag) are untouched; when a
 * second finger lands mid-gesture this hook dispatches
 * {@link TOUCH_GESTURE_START_EVENT} so those gestures cancel, then owns the
 * pointers until fewer than two remain.
 *
 * Coordinate model (matches ViewportCanvas): the surface renders at
 * `translate(pan) scale(zoom)` with transform-origin `50% 0`, so for a
 * surface-local point (u, v) measured from the origin,
 *   screenX = surfLeft + surfHalfW + pan.x + u * zoom
 *   screenY = pan.y + v * zoom
 * Pinch keeps the world point under the gesture midpoint fixed while the
 * midpoint itself drags the canvas (pan).
 */
export function useTouchPanZoom(options: UseTouchPanZoomOptions): {
  isTouchGesturing: boolean;
  touchGestureActiveRef: MutableRefObject<boolean>;
} {
  const [isTouchGesturing, setIsTouchGesturing] = useState(false);
  const touchGestureActiveRef = useRef(false);

  // Ref mirror so the stable listeners always read the latest options.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = optionsRef.current.canvasRef.current;
    if (!el) return;

    const pointers = new Map<number, Point>();
    let baseline: GestureBaseline | null = null;

    const firstTwo = (): [Point, Point] => {
      const [a, b] = [...pointers.values()];
      return [a, b];
    };

    const beginGesture = () => {
      const { surfaceRef, zoomRef, panRef } = optionsRef.current;
      const [a, b] = firstTwo();
      const rect = el.getBoundingClientRect();
      const surface = surfaceRef.current;
      const surfLeft = surface ? surface.offsetLeft : 0;
      const surfHalfW = surface ? surface.offsetWidth / 2 : 0;
      const zoom = zoomRef.current;
      const pan = panRef.current;
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      baseline = {
        zoom,
        dist: Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1),
        u: (mx - (surfLeft + surfHalfW + pan.x)) / zoom,
        v: (my - pan.y) / zoom,
        rectLeft: rect.left,
        rectTop: rect.top,
        surfLeft,
        surfHalfW,
      };
      if (!touchGestureActiveRef.current) {
        touchGestureActiveRef.current = true;
        setIsTouchGesturing(true);
        // Cancel any in-flight single-pointer gesture (marquee, reparent).
        window.dispatchEvent(new Event(TOUCH_GESTURE_START_EVENT));
      }
    };

    const endGesture = () => {
      baseline = null;
      if (touchGestureActiveRef.current) {
        touchGestureActiveRef.current = false;
        setIsTouchGesturing(false);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Two (or more) fingers: (re)baseline on the first two pointers.
      if (pointers.size >= 2) beginGesture();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!touchGestureActiveRef.current || !baseline || pointers.size < 2) return;
      if (e.cancelable) e.preventDefault();

      const { minZoom, maxZoom, setPan, setZoom } = optionsRef.current;
      const [a, b] = firstTwo();
      const dist = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
      const newZoom = Math.min(
        Math.max(baseline.zoom * (dist / baseline.dist), minZoom),
        maxZoom,
      );
      const mx = (a.x + b.x) / 2 - baseline.rectLeft;
      const my = (a.y + b.y) / 2 - baseline.rectTop;
      setPan({
        x: mx - baseline.u * newZoom - baseline.surfLeft - baseline.surfHalfW,
        y: my - baseline.v * newZoom,
      });
      setZoom(newZoom);
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!pointers.delete(e.pointerId)) return;
      if (!touchGestureActiveRef.current) return;
      // A finger lifted mid-gesture: rebaseline if two remain, else finish
      // (the remaining single pointer does nothing until it lifts).
      if (pointers.size >= 2) beginGesture();
      else endGesture();
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      endGesture();
    };
    // The canvas element is stable for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isTouchGesturing, touchGestureActiveRef };
}
