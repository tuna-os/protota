import React from 'react';

const BREAKPOINTS = [360, 600, 900];

export const BreakpointBar: React.FC<{ width: number; onChange: (w: number) => void }> = ({ width, onChange }) => (
  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
    {BREAKPOINTS.map(bp => (
      <button key={bp} className={`protota-btn${width === bp ? ' protota-btn--primary' : ''}`}
        onClick={() => onChange(bp)}
        style={{ fontSize: '10px', padding: '2px 8px' }}
      >{bp}px</button>
    ))}
  </div>
);
