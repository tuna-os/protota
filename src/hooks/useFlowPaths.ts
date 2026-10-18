import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { MockupDocument } from '../types/mockup';

interface FlowPath {
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
 * The frame size laid out on the surface. Pass it as a dependency to
 * re-measure during a resize drag, when the frames change size and the
 * document does not.
 */
export interface FlowGeometry {
  screenId: string;
  width: number;
  height: number;
}

interface UseFlowPathsOptions {
  surfaceRef: RefObject<HTMLDivElement | null>;
  doc: MockupDocument;
  showFlows: boolean;
  geometry: FlowGeometry | null;
}

/**
 * Build cubic flow curves from the laid-out frame geometry. The surface is
 * measured before its transform, so the curves pan and zoom with the screens.
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
 * Measure the rendered frames and derive the paths for the flow overlay.
 * `doc` covers node edits that move frames. `geometry` covers size changes,
 * which reach the frames during a drag and do not change the document.
 */
export function useFlowPaths({
  surfaceRef,
  doc,
  showFlows,
  geometry,
}: UseFlowPathsOptions): FlowPath[] {
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
  }, [
    doc,
    showFlows,
    surfaceRef,
    geometry?.screenId,
    geometry?.width,
    geometry?.height,
  ]);

  return flowPaths;
}
