import { describe, expect, it } from 'vitest';
import { buildFlowPaths, type FlowFrameMetrics } from '../hooks/useFlowPaths';

describe('buildFlowPaths', () => {
  it('routes a forward edge from the source right edge to the target left edge', () => {
    const frames = new Map<string, FlowFrameMetrics>([
      ['source', { left: 0, top: 10, width: 100, height: 200 }],
      ['target', { left: 200, top: 30, width: 100, height: 100 }],
    ]);

    expect(buildFlowPaths([
      { id: 'forward', sourceId: 'source', targetId: 'target' },
    ], frames)).toEqual([
      { id: 'forward', d: 'M 100 110 C 133.33333333333334 110, 166.66666666666666 80, 200 80' },
    ]);
  });

  it('routes a reverse edge from the source left edge to the target right edge', () => {
    const frames = new Map<string, FlowFrameMetrics>([
      ['source', { left: 300, top: 10, width: 80, height: 100 }],
      ['target', { left: 100, top: 40, width: 50, height: 60 }],
    ]);

    expect(buildFlowPaths([
      { id: 'reverse', sourceId: 'source', targetId: 'target' },
    ], frames)).toEqual([
      { id: 'reverse', d: 'M 300 60 C 250 60, 200 70, 150 70' },
    ]);
  });

  it('omits edges whose screen frame is not laid out', () => {
    const frames = new Map<string, FlowFrameMetrics>([
      ['source', { left: 0, top: 0, width: 100, height: 100 }],
    ]);

    expect(buildFlowPaths([
      { id: 'missing-target', sourceId: 'source', targetId: 'target' },
    ], frames)).toEqual([]);
  });
});
