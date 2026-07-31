import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useMockupStore } from "../store/mockupStore";
import { AdwaitaRenderer } from "./AdwaitaRenderer";
import { BottomBar } from "./BottomBar";
import { useDndStore } from "../dnd/dndStore";
import { resolveDropTarget } from "../dnd/dropResolution";
import { DropIndicator } from "../dnd/DropIndicator";
import { QuantiseHintChip } from "../dnd/QuantiseHint";
import { noteDropQuantise } from "../dnd/quantise";
import { findNodeById } from "../utils/treeHelpers";
import { filterShallowest, screenOf, unionSelection } from "../utils/selection";
import type { AdwNode, AdwNodeType } from "../types/mockup";
import { windowCloseSymbolic } from "@gjsify/adwaita-icons/ui";
import { toDataUri } from "@gjsify/adwaita-icons/utils";

const CANVAS_PADDING = 60;
const CANVAS_GAP = 40;
const CANVAS_BOTTOM_BAR_H = 48;

/** Total world-space width of all screens + gaps + padding. */
function getTotalContentWidth(screens: { width?: number }[]): number {
  return screens.reduce((sum, s) => sum + (s.width || 800), 0)
    + CANVAS_GAP * (screens.length - 1) + CANVAS_PADDING * 2;
}

/**
 * Compute new pan so that the world point under (mx, my) stays fixed
 * when zoom changes from oldZoom → newZoom.
 */
function zoomAtPoint(
  mx: number,
  my: number,
  oldZoom: number,
  newZoom: number,
  oldPan: { x: number; y: number },
  canvasW: number,
): { x: number; y: number } {
  const cx = canvasW / 2;
  const wy = (my - oldPan.y) / oldZoom;
  return {
    x: (mx - cx) * (1 - newZoom / oldZoom) + oldPan.x * (newZoom / oldZoom),
    y: my - wy * newZoom,
  };
}

export const ViewportCanvas: React.FC = () => {
  const { doc, selectNode, showFlows } = useMockupStore();

  // Ref mirror of doc — lets stable callbacks read latest screens without re-creating
  const docRef = useRef(doc);
  docRef.current = doc;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Ref versions so event handlers always read latest values without re-attaching
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const startPan = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Stable zoom helpers (read from refs, never re-create) ---

  const zoomAtCenter = useCallback((factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.min(Math.max(oldZ * factor, 0.3), 2.5);
    setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current, rect.width));
    setZoom(newZ);
  }, []);

  const resetView = useCallback(() => {
    const el = canvasRef.current;
    if (!el || docRef.current.screens.length === 0) return;
    setPan({ x: 0, y: CANVAS_PADDING });
    setZoom(1);
  }, []);

  // --- Wheel handler (stable, reads from refs) ---

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const isOverCanvas = el.contains(e.target as Node);
      if ((e.ctrlKey || e.metaKey) && isOverCanvas) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const oldZ = zoomRef.current;
        const newZ = Math.min(Math.max(oldZ * factor, 0.3), 2.5);
        setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current, rect.width));
        setZoom(newZ);
      } else if (e.shiftKey && isOverCanvas) {
        e.preventDefault();
        setPan((p) => ({ x: p.x - e.deltaY, y: p.y }));
      } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // --- Mouse handlers (all stable via refs) ---

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || spaceDown.current) {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      startPan.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current) {
      setPan({ x: e.clientX - startPan.current.x, y: e.clientY - startPan.current.y });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  const handleCanvasClick = useCallback(() => {
    canvasRef.current?.focus();
    selectNode(null);
  }, [selectNode]);

  // --- Drag and drop (#79) ---
  //
  // Two mechanisms, per docs/penpot-study.md §4: native HTML5 drag events for
  // palette → canvas insertion, pointer events for reparenting a node already
  // on the canvas. Both resolve the drop to container + index (+ slot) — the
  // constraint model has no coordinates — and both keep the document
  // untouched until the drop commits exactly one mutation.

  // Native listeners, not React synthetic handlers: the adw-* custom
  // elements reparent internal DOM, and events originating there never reach
  // React's delegated listeners (see the selection note in AdwaitaRenderer).
  // Plain DOM bubbling to the canvas root always works.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleDragOver = (e: DragEvent) => {
      const { drag, setTarget } = useDndStore.getState();
      if (drag?.kind !== "palette") return;
      e.preventDefault();
      const target = resolveDropTarget(
        docRef.current, e.target as Element, e.clientX, e.clientY,
        { draggedType: drag.widgetType },
      );
      if (e.dataTransfer) e.dataTransfer.dropEffect = target ? "copy" : "none";
      setTarget(target);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node)) {
        useDndStore.getState().setTarget(null);
      }
    };

    const handleDrop = (e: DragEvent) => {
      const { drag, target, endDrag } = useDndStore.getState();
      if (drag?.kind !== "palette") return;
      e.preventDefault();
      // An illegal target shows no indicator and the drop does nothing.
      if (target) {
        const store = useMockupStore.getState();
        const id = store.addChildNode(target.parentId, drag.widgetType, target.slot, target.index);
        if (id) {
          store.selectNode(id, target.screenId);
          noteDropQuantise(store.doc, target.parentId, target.screenId);
        }
      }
      endDrag();
    };

    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("dragleave", handleDragLeave);
    el.addEventListener("drop", handleDrop);
    return () => {
      el.removeEventListener("dragover", handleDragOver);
      el.removeEventListener("dragleave", handleDragLeave);
      el.removeEventListener("drop", handleDrop);
    };
  }, []);

  // Reparent drag: pointer-drag the selected node into another container.
  // A small movement threshold separates click from drag; pointer capture
  // keeps the gesture alive outside the screen frame; Escape cancels; the
  // drop commits one moveNode (one undo entry).
  const handleNodePointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0 || spaceDown.current || isPanningRef.current) return;
    const sourceEl = (e.target as Element).closest?.("[data-node-id]") as HTMLElement | null;
    if (!sourceEl) return;
    const nodeId = sourceEl.dataset.nodeId!;
    const store = useMockupStore.getState();
    if (nodeId !== store.selectedNodeId) return;
    // Screen roots are anchors, not draggable layers.
    if (store.doc.screens.some((s) => s.rootNode.id === nodeId)) return;
    let draggedType: AdwNodeType | null = null;
    for (const screen of store.doc.screens) {
      const found = findNodeById([screen.rootNode], nodeId);
      if (found) { draggedType = found.type; break; }
    }
    if (!draggedType) return;

    const gesture = {
      startX: e.clientX, startY: e.clientY,
      active: false, cancelled: false,
    };
    const pointerId = e.pointerId;
    const dnd = useDndStore.getState();

    const cleanupVisuals = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const onMove = (ev: PointerEvent) => {
      if (gesture.cancelled) return;
      if (!gesture.active) {
        if (Math.hypot(ev.clientX - gesture.startX, ev.clientY - gesture.startY) < 5) return;
        gesture.active = true;
        dnd.startDrag({ kind: "node", nodeId });
        try { sourceEl.setPointerCapture(pointerId); } catch { /* capture is best-effort */ }
        document.body.style.userSelect = "none";
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const inCanvas = hit && canvasRef.current?.contains(hit);
      const target = inCanvas
        ? resolveDropTarget(docRef.current, hit, ev.clientX, ev.clientY, {
            draggedType: draggedType!,
            excludeNodeId: nodeId,
          })
        : null;
      dnd.setTarget(target);
      document.body.style.cursor = target ? "grabbing" : "not-allowed";
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && gesture.active && !gesture.cancelled) {
        ev.stopPropagation();
        gesture.cancelled = true;
        dnd.endDrag();
        cleanupVisuals();
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKeyDown, true);
      cleanupVisuals();
      if (gesture.active) {
        // The click that follows a completed drag must not re-run selection
        // or the canvas deselect.
        const swallowClick = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
        window.addEventListener("click", swallowClick, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallowClick, true), 150);
      }
      const { target, endDrag } = useDndStore.getState();
      if (gesture.active && !gesture.cancelled && target) {
        // One mutation, one undo entry. The resolved slot is authoritative:
        // an unslotted container clears any stale slot from the old parent.
        useMockupStore.getState().moveNode(nodeId, target.parentId, target.index, target.slot ?? "");
        noteDropQuantise(useMockupStore.getState().doc, target.parentId, target.screenId);
      }
      endDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("pointerdown", handleNodePointerDown);
    return () => el.removeEventListener("pointerdown", handleNodePointerDown);
  }, [handleNodePointerDown]);

  // --- Rubber-band marquee (#79, penpot-study.md §3) ---
  //
  // Starts only on empty canvas space, so it can never conflict with the
  // pointer-reparent drag above (which requires the pointer to go down on a
  // selected node). Selection matches by DOM-rect intersection — no worker,
  // no geometric index; a mockup has tens of nodes — with two adaptations:
  // a container (node with children) counts only when the marquee fully
  // contains it (pure intersection would always select every ancestor of any
  // matched leaf), and shallowest-ancestor filtering drops descendants of
  // other matches. Shift adds to the pre-gesture selection.
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const handleMarqueePointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0 || spaceDown.current || isPanningRef.current) return;
    const target = e.target as Element;
    if (target.closest?.("[data-node-id], .protota-zoom-bar, button, select, input, .protota-screen-label")) return;

    const gesture = {
      startX: e.clientX, startY: e.clientY, active: false,
      additive: e.shiftKey,
      baseline: useMockupStore.getState().selectedNodeIds,
    };

    const applySelection = (rect: { left: number; top: number; width: number; height: number }) => {
      const el = canvasRef.current;
      if (!el) return;
      const doc = docRef.current;
      const right = rect.left + rect.width;
      const bottom = rect.top + rect.height;
      const rootIds = new Set(doc.screens.map((s) => s.rootNode.id));
      const hits: string[] = [];
      el.querySelectorAll<HTMLElement>("[data-node-id]").forEach((nodeEl) => {
        const id = nodeEl.dataset.nodeId!;
        if (rootIds.has(id)) return; // screen roots are anchors, never marquee-picked
        const b = nodeEl.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) return;
        const intersects = b.left < right && b.right > rect.left && b.top < bottom && b.bottom > rect.top;
        if (!intersects) return;
        let node: AdwNode | null = null;
        for (const screen of doc.screens) {
          node = findNodeById([screen.rootNode], id);
          if (node) break;
        }
        if (!node) return;
        const isContainer = (node.children?.length ?? 0) > 0;
        const contained = b.left >= rect.left && b.right <= right && b.top >= rect.top && b.bottom <= bottom;
        if (isContainer && !contained) return;
        hits.push(id);
      });
      const ids = filterShallowest(hits, doc.screens);
      const merged = gesture.additive ? unionSelection(gesture.baseline, ids) : ids;
      const screen = merged.length ? screenOf(doc.screens, merged[merged.length - 1]) : null;
      useMockupStore.getState().selectNodes(merged, screen?.id);
    };

    const onMove = (ev: PointerEvent) => {
      if (!gesture.active) {
        if (Math.hypot(ev.clientX - gesture.startX, ev.clientY - gesture.startY) < 5) return;
        gesture.active = true;
        document.body.style.userSelect = "none";
      }
      const rect = {
        left: Math.min(gesture.startX, ev.clientX),
        top: Math.min(gesture.startY, ev.clientY),
        width: Math.abs(ev.clientX - gesture.startX),
        height: Math.abs(ev.clientY - gesture.startY),
      };
      setMarquee(rect);
      applySelection(rect);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      setMarquee(null);
      if (gesture.active) {
        // The click that ends the gesture must not run the canvas deselect.
        const swallowClick = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
        window.addEventListener("click", swallowClick, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallowClick, true), 150);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("pointerdown", handleMarqueePointerDown);
    return () => el.removeEventListener("pointerdown", handleMarqueePointerDown);
  }, [handleMarqueePointerDown]);

  // --- Keyboard: Escape + Space (pan mode) ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectNode(null);
      }
      if (e.code === "Space") {
        if (!canvasRef.current?.contains(e.target as Node)) return;
        e.preventDefault();
        spaceDown.current = true;
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (!canvasRef.current?.contains(e.target as Node)) return;
        spaceDown.current = false;
        setSpaceHeld(false);
        isPanningRef.current = false;
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectNode]);

  // --- Keyboard: zoom shortcuts (Ctrl+= / - / 0) — uses stable callbacks, no stale closure ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA"
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "=" && mod) {
        e.preventDefault();
        zoomAtCenter(1.1);
      }
      if (e.key === "-" && mod) {
        e.preventDefault();
        zoomAtCenter(0.9);
      }
      if (e.key === "0" && mod) {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomAtCenter, resetView]);

  // --- Custom events: zoom from MenuBar — uses stable callbacks, no stale closure ---

  useEffect(() => {
    const onZoomIn = () => zoomAtCenter(1.1);
    const onZoomOut = () => zoomAtCenter(0.9);
    const onZoomReset = () => resetView();
    window.addEventListener("protota:zoom-in", onZoomIn);
    window.addEventListener("protota:zoom-out", onZoomOut);
    window.addEventListener("protota:zoom-reset", onZoomReset);
    return () => {
      window.removeEventListener("protota:zoom-in", onZoomIn);
      window.removeEventListener("protota:zoom-out", onZoomOut);
      window.removeEventListener("protota:zoom-reset", onZoomReset);
    };
  }, [zoomAtCenter, resetView]);

  // --- Auto-fit zoom on mobile screens (< 768px wide) ---

  useEffect(() => {
    const autoFitMobile = () => {
      const screens = docRef.current.screens;
      if (window.innerWidth <= 768 && screens.length > 0) {
        const primaryWidth = screens[0].width || 800;
        const availableWidth = window.innerWidth - 32;
        if (primaryWidth > availableWidth) {
          const fittedZoom = Math.max(availableWidth / primaryWidth, 0.35);
          setZoom(fittedZoom);
          setPan({ x: 16, y: 16 });
        }
      }
    };
    autoFitMobile();
    window.addEventListener('resize', autoFitMobile);
    return () => window.removeEventListener('resize', autoFitMobile);
  }, [doc.screens]);

  // --- Center content on initial mount ---
  useEffect(() => {
    resetView();
  }, [resetView]);

  // --- Screen focus state ---

  // Flow-edge geometry: measured from the laid-out screen frames, in the
  // surface's own (pre-transform) coordinates so arrows pan/zoom with it.
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [flowPaths, setFlowPaths] = useState<Array<{ id: string; d: string }>>([]);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !showFlows || !doc.edges.length) { setFlowPaths([]); return; }
    const frames = new Map<string, HTMLElement>();
    surface.querySelectorAll<HTMLElement>('[data-protota-flow-screen]').forEach((element) => {
      frames.set(element.dataset.prototaFlowScreen!, element);
    });
    const paths: Array<{ id: string; d: string }> = [];
    for (const edge of doc.edges) {
      const source = frames.get(edge.sourceId);
      const target = frames.get(edge.targetId);
      if (!source || !target) continue;
      const sx = source.offsetLeft + (source.offsetLeft < target.offsetLeft ? source.offsetWidth : 0);
      const sy = source.offsetTop + source.offsetHeight / 2;
      const tx = target.offsetLeft + (source.offsetLeft < target.offsetLeft ? 0 : target.offsetWidth);
      const ty = target.offsetTop + target.offsetHeight / 2;
      const bend = Math.max(30, Math.abs(tx - sx) / 3);
      const direction = source.offsetLeft < target.offsetLeft ? 1 : -1;
      paths.push({
        id: edge.id,
        d: `M ${sx} ${sy} C ${sx + bend * direction} ${sy}, ${tx - bend * direction} ${ty}, ${tx} ${ty}`,
      });
    }
    setFlowPaths(paths);
  }, [doc, showFlows]);

  const [phoshScreenId, setPhoshScreenId] = useState<string | null>(null);
  const [desktopScreenId, setDesktopScreenId] = useState<string | null>(null);
  const [focusedScreenIdx, setFocusedScreenIdx] = useState(0);

  const focusedScreenIdxRef = useRef(focusedScreenIdx);
  focusedScreenIdxRef.current = focusedScreenIdx;
  const desktopScreenIdRef = useRef(desktopScreenId);
  desktopScreenIdRef.current = desktopScreenId;
  const phoshScreenIdRef = useRef(phoshScreenId);
  phoshScreenIdRef.current = phoshScreenId;

  // Clamp focusedScreenIdx when screens shrink (e.g. deletion)
  useEffect(() => {
    if (doc.screens.length > 0 && focusedScreenIdx >= doc.screens.length) {
      setFocusedScreenIdx(doc.screens.length - 1);
    }
  }, [doc.screens.length, focusedScreenIdx]);

  const activePhoshScreen = doc.screens.find((s) => s.id === phoshScreenId);
  const activeDesktopScreen = doc.screens.find((s) => s.id === desktopScreenId);

  // Memoized screen list for BottomBar — only recomputes when screen ids/titles change,
  // not on every node edit inside a screen.
  const screensForBottomBar = useMemo(
    () => doc.screens.map((s, i) => ({ id: s.id, title: `${i + 1}: ${s.title}` })),
    [doc.screens.map((s) => `${s.id}:${s.title}`).join('|')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // --- Stable screen-focus callbacks (read from refs) ---

  const panToScreen = useCallback((idx: number) => {
    const screens = docRef.current.screens;
    if (!canvasRef.current || screens.length === 0) return;
    const clampedIdx = Math.max(0, Math.min(idx, screens.length - 1));
    const screen = screens[clampedIdx];
    if (!screen) return;

    const currentZoom = zoomRef.current;
    const surfaceW = getTotalContentWidth(docRef.current.screens);

    let screenX = CANVAS_PADDING;
    for (let i = 0; i < clampedIdx; i++) {
      screenX += (screens[i].width || 800) + CANVAS_GAP;
    }

    const screenW = screen.width || 800;
    setPan({
      x: (surfaceW / 2 - screenX - screenW / 2) * currentZoom,
      y: CANVAS_PADDING,
    });
  }, []);

  const handleFocusScreen = useCallback((idx: number) => {
    const screens = docRef.current.screens;
    if (screens.length === 0) return;
    if (idx < 0 || idx >= screens.length) return;
    setFocusedScreenIdx(idx);

    if (desktopScreenIdRef.current !== null) {
      setDesktopScreenId(screens[idx].id);
    } else if (phoshScreenIdRef.current !== null) {
      setPhoshScreenId(screens[idx].id);
    } else {
      panToScreen(idx);
    }
  }, [panToScreen]);

  const handleFocusPrev = useCallback(() => {
    handleFocusScreen(focusedScreenIdxRef.current - 1);
  }, [handleFocusScreen]);

  const handleFocusNext = useCallback(() => {
    handleFocusScreen(focusedScreenIdxRef.current + 1);
  }, [handleFocusScreen]);

  // --- Stable BottomBar zoom callbacks (additive, distinct from keyboard multiplicative) ---

  const handleZoomIn = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.min(oldZ + 0.1, 2.5);
    setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current, rect.width));
    setZoom(newZ);
  }, []);

  const handleZoomOut = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.max(oldZ - 0.1, 0.3);
    setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current, rect.width));
    setZoom(newZ);
  }, []);

  const handleZoomFit = useCallback(() => {
    const el = canvasRef.current;
    if (!el || docRef.current.screens.length === 0) return;
    const screens = docRef.current.screens;
    const canvasW = el.clientWidth;
    const canvasH = el.clientHeight;
    const totalContentW = getTotalContentWidth(screens);
    const maxContentH = Math.max(...screens.map((s) => s.height || 600))
      + 28 /* label */ + CANVAS_PADDING * 2;
    const fitZoom = Math.min(canvasW / totalContentW, canvasH / maxContentH, 1.5);
    setZoom(fitZoom);
    const scaledH = maxContentH * fitZoom;
    setPan({
      x: 0,
      y: (canvasH - scaledH - CANVAS_BOTTOM_BAR_H) / 2,
    });
  }, []);

  // --- Stable Desktop/Phosh toggle callbacks ---

  const handleToggleDesktop = useCallback(() => {
    setDesktopScreenId((prev) => {
      if (prev) return null;
      setPhoshScreenId(null);
      return docRef.current.screens[focusedScreenIdxRef.current]?.id || null;
    });
  }, []);

  const handleTogglePhone = useCallback(() => {
    setPhoshScreenId((prev) => {
      if (prev) return null;
      setDesktopScreenId(null);
      return docRef.current.screens[focusedScreenIdxRef.current]?.id || null;
    });
  }, []);

  return (
    <div
      ref={canvasRef}
      tabIndex={0}
      className="protota-canvas"

      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        outline: "none",
        cursor: isPanning ? "grabbing" : "default",
        backgroundImage: "radial-gradient(circle, rgba(128,128,128,0.25) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        display: "flex",
        // `safe` falls back to start alignment when the content is wider than
        // the canvas. Plain `center` overflows equally on both sides, putting
        // the left edge outside the clipped region and underneath the sidebar,
        // where it cannot be clicked.
        justifyContent: "safe center",
        alignItems: "flex-start",
      }}
    >
      {/* GNOME Desktop Fullscreen Live Interactive Preview Mode */}
      {activeDesktopScreen && (
        <div className="protota-gnome-desktop-container">
          <div className="protota-gnome-topbar">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Activities</span>
              <select
                value={desktopScreenId || ''}
                onChange={(e) => setDesktopScreenId(e.target.value)}
                style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
              >
                {doc.screens.map((s) => (
                  <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.title}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '13px' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button
              className="protota-btn suggested"
              onClick={() => setDesktopScreenId(null)}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  maskImage: toDataUri(windowCloseSymbolic),
                  WebkitMaskImage: toDataUri(windowCloseSymbolic),
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  backgroundColor: "currentColor",
                  marginRight: "4px",
                }}
              />
              Exit Desktop Mode
            </button>
          </div>

          <div className="protota-gnome-window-frame">
            <AdwaitaRenderer
              node={activeDesktopScreen.rootNode}
              screenId={activeDesktopScreen.id}
            />
          </div>
        </div>
      )}

      {/* Phosh Fullscreen Phone Overlay Mode */}
      {activePhoshScreen && (
        <div className="protota-phosh-container">
          <div className="protota-phosh-header">
            <span>📱 Phosh Phone View</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={phoshScreenId || ''}
                onChange={(e) => setPhoshScreenId(e.target.value)}
                style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}
              >
                {doc.screens.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button
                className="protota-btn suggested"
                onClick={() => setPhoshScreenId(null)}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    maskImage: toDataUri(windowCloseSymbolic),
                    WebkitMaskImage: toDataUri(windowCloseSymbolic),
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    backgroundColor: "currentColor",
                    marginRight: "4px",
                  }}
                />
                Exit Phone Mode
              </button>
            </div>
          </div>

          <div className="protota-phosh-phone-frame">
            <AdwaitaRenderer
              node={activePhoshScreen.rootNode}
              screenId={activePhoshScreen.id}
            />
          </div>
        </div>
      )}

      {/* Bottom Bar — Zoom + Desktop/Phone toggles */}
      <BottomBar
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        onZoomReset={resetView}
        desktopScreenId={desktopScreenId}
        onToggleDesktop={handleToggleDesktop}
        phoshScreenId={phoshScreenId}
        onTogglePhone={handleTogglePhone}
        screens={screensForBottomBar}
        focusedScreenIdx={focusedScreenIdx}
        canFocusPrev={focusedScreenIdx > 0}
        canFocusNext={focusedScreenIdx < doc.screens.length - 1}
        onFocusPrev={handleFocusPrev}
        onFocusNext={handleFocusNext}
        onSelectScreen={handleFocusScreen}
      />

      {/* Drop preview (#79): candidate-container highlight + insertion caret.
          Fixed-positioned, so it lives outside the transformed surface. */}
      <DropIndicator />

      {/* Post-drop spacing quantise offer (#79): transient, one undo step. */}
      <QuantiseHintChip />

      {/* Rubber-band marquee (#79): fixed-positioned editor chrome. */}
      {marquee && (
        <div
          className="protota-marquee"
          data-testid="marquee"
          style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
        />
      )}

      {/* Transformable Canvas Surface */}
      <div
        ref={surfaceRef}
        className="protota-canvas-surface"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "50% 0",
          transition: isPanning ? "none" : "transform 0.2s ease",
          display: "inline-flex",
          alignItems: "flex-start",
          gap: `${CANVAS_GAP}px`,
          padding: `${CANVAS_PADDING}px`,
          pointerEvents: spaceHeld || isPanning ? "none" : undefined,
          // No max-width: screens keep their real sizes side by side; pan and
          // zoom handle overflow. Positioned so the flow overlay can anchor.
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* Flow edges: navigation connectors between screens (#11). Drawn
            inside the transformed surface so they pan/zoom with the screens. */}
        {flowPaths.length > 0 && (
          <svg
            className="protota-flow-overlay"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 5 }}
          >
            <defs>
              <marker id="protota-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-color, #3584e4)" />
              </marker>
            </defs>
            {flowPaths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill="none"
                stroke="var(--accent-color, #3584e4)"
                strokeWidth={2}
                strokeDasharray="6 4"
                markerEnd="url(#protota-flow-arrow)"
                opacity={0.85}
              />
            ))}
          </svg>
        )}
        {doc.screens.map((screen) => (
          <div
            key={screen.id}
            data-protota-flow-screen={screen.id}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
          >
            <div className="protota-screen-label" style={{ marginBottom: "8px" }}>
              {screen.title}
            </div>
            <AdwaitaRenderer
              node={screen.rootNode}
              screenId={screen.id}
              screenWidth={screen.width}
              screenHeight={screen.height}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
