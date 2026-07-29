import React from 'react';
import { useMockupStore } from '../store/mockupStore';
import { WIDGET_SCHEMAS } from '../schemas/widgetSchemas';
import type { AdwNode } from '../types/mockup';
import { findNodeById } from '../utils/treeHelpers';
import { NodeActions } from './NodeActions';
import { IconPicker } from './IconPicker';

export const InspectorPanel: React.FC = () => {
  const { doc, selectedNodeId, selectedScreenId, updateNodeProps } = useMockupStore();

  const selectedNode: AdwNode | null = (() => {
    if (!selectedNodeId || !selectedScreenId) return null;
    const screen = doc.screens.find((s) => s.id === selectedScreenId);
    if (!screen) return null;
    return findNodeById([screen.rootNode], selectedNodeId);
  })();

  if (!selectedNode) {
    return (
      <div style={{ padding: '16px', opacity: 0.5, fontStyle: 'italic' }}>
        Select an element on the canvas to inspect.
      </div>
    );
  }

  const schema = WIDGET_SCHEMAS[selectedNode.type] || [];

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <NodeActions nodeId={selectedNode.id} />

      <div>
        <span className="protota-field-label" style={{ fontSize: '10px' }}>Widget Type</span>
        <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Adwaita Mono' }}>
          {selectedNode.type}
        </div>
      </div>

      <hr className="protota-divider" />

      {schema.map((field) => {
        const value = (selectedNode)[field.key] ?? field.defaultValue ?? '';

        return (
          <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="protota-field-label">{field.label}</label>

            {field.type === 'string' && (
              <input
                type="text"
                className="protota-input"
                value={String(value)}
                onChange={(e) => updateNodeProps(selectedNode.id, { [field.key]: e.target.value })}
              />
            )}
            {field.type === 'boolean' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => updateNodeProps(selectedNode.id, { [field.key]: e.target.checked })}
                />
                <span style={{ fontSize: '13px' }}>Enabled</span>
              </label>
            )}
            {field.type === 'number' && (
              <input
                type="number"
                className="protota-input"
                value={Number(value)}
                onChange={(e) => updateNodeProps(selectedNode.id, { [field.key]: Number(e.target.value) })}
              />
            )}
            {field.type === 'icon' && (
              <IconPicker
                value={String(value)}
                onChange={(iconName: string) =>
                  updateNodeProps(selectedNode.id, { [field.key]: iconName })
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
