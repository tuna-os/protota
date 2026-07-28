import React from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { AdwNode } from '../types/mockup';

export const LayersPanel: React.FC = () => {
  const { doc, selectedNodeId, selectNode } = useMockupStore();

  const renderTree = (node: AdwNode, depth = 0): React.ReactNode => {
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 14}px` }}>
        <div
          onClick={() => selectNode(node.id)}
          className={`adwmock-tree-item${isSelected ? ' adwmock-tree-item--selected' : ''}`}
        >
          <span>{node.type.replace('adw-', '')} ({node.title || 'Untitled'})</span>
        </div>
        {node.children?.map((child) => renderTree(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ padding: '12px' }}>
      {doc.screens.map((screen) => (
        <div key={screen.id} style={{ marginBottom: '16px' }}>
          <div className="adwmock-screen-label" style={{ marginBottom: '6px' }}>
            🖥 {screen.title}
          </div>
          {renderTree(screen.rootNode)}
        </div>
      ))}
    </div>
  );
};
