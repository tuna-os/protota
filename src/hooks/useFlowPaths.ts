import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { MockupDocument } from '../types/mockup';

export interface FlowPath {
  id: string;
  d: string;
}

export interface FlowFrameMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Build cubic flow curves from the laid-out screen-frame geometry.
 *
 * The surface is measured before its transform, so the returned paths move
 * with the screens when ViewportCanvas pans or zooms the surface.
 */
export function buildFlowPaths(
  edges: MockupDocument['edges'],
  frames: ReadonlyMap<string, FlowFrameMetrics>,
): FlowPath[] {
  const paths: FlowPath[] = [];
  for (const edge of edges) {
    const source = frames.get(edge.sourceId);
    const target = frames.get(edge.targetId);
    if (!source || !target) continue;

    const forward = source.left < target.left;
    const sx = source.left + (forward ? source.width : 0);
    const sy = source.top + source.height / 2;
    const tx = target.left + (forward ? 0 : target.width);
    const ty = target.top + target.height / 2;
    const bend = Math.max(30, Math.abs(tx - sx) / 3);
    const direction = forward ? 1 : -1;

    paths.push({
      id: edge.id,
      d: `M ${sx} ${sy} C ${sx + bend * direction} ${sy}, ${tx - bend * direction} ${ty}, ${tx} ${ty}`,
    });
  }
  return paths;
}

/**
 * Measure the rendered screen frames and derive the paths shown by the flow
 * overlay. The document dependency intentionally mirrors ViewportCanvas's
 * previous effect: node edits can change frame geometry even when edges do
 * not change.
 */
export function useFlowPaths(
  surfaceRef: RefObject<HTMLDivElement | null>,
  doc: MockupDocument,
  showFlows: boolean,
): FlowPath[] {
  const [flowPaths, setFlowPaths] = useState<FlowPath[]>([]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !showFlows || !doc.edges.length) {
      setFlowPaths([]);
      return;
    }

    const frames = new Map<string, FlowFrameMetrics>();
    surface.querySelectorAll<HTMLElement>('[data-protota-flow-screen]').forEach((element) => {
      frames.set(element.dataset.prototaFlowScreen!, {
        left: element.offsetLeft,
        top: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    });
    setFlowPaths(buildFlowPaths(doc.edges, frames));
  }, [doc, showFlows, surfaceRef]);

  return flowPaths;
}
