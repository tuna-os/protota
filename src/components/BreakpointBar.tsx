import React from 'react';

/**
 * Quick device-size presets for the focused screen, mounted in the bottom
 * bar beside the Desktop/Phone preview toggles. Sizes follow the corpus
 * (docs/spec/tokens/sizing.md): 360 wide is GNOME's universal phone minimum
 * width; 1280×800 is a comfortable laptop default. 800×600 sits just above
 * the corpus's densest breakpoint band (500–700sp), so toggling between it
 * and Phone crosses most imported apps' adaptive thresholds.
 */
export interface DeviceSizePreset {
  label: string;
  width: number;
  height: number;
}

export const DEVICE_SIZE_PRESETS: DeviceSizePreset[] = [
  { label: 'Phone', width: 360, height: 720 },
  { label: '800×600', width: 800, height: 600 },
  { label: '1280×800', width: 1280, height: 800 },
];

export const BreakpointBar: React.FC<{
  width?: number;
  height?: number;
  onChange: (size: { width: number; height: number }) => void;
}> = ({ width, height, onChange }) => (
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} data-testid="device-size-presets">
    {DEVICE_SIZE_PRESETS.map((preset) => {
      const active = width === preset.width && height === preset.height;
      return (
        <button
          key={preset.label}
          className={`protota-btn${active ? ' protota-btn--primary' : ''}`}
          data-testid={`size-preset-${preset.width}x${preset.height}`}
          title={`Resize focused screen to ${preset.width}×${preset.height}`}
          onClick={() => onChange({ width: preset.width, height: preset.height })}
          style={{ fontSize: '10px', padding: '2px 8px' }}
        >{preset.label}</button>
      );
    })}
  </div>
);
