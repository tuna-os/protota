import React from 'react';
import { useMockupStore } from '../store/mockupStore';

interface Props { x: number; y: number; onClose: () => void }

export const ContextMenu: React.FC<Props> = ({ x, y, onClose }) => {
  const { deleteNode, selectedNodeId, undo, redo } = useMockupStore();

  const items = [
    { label: 'Undo', action: () => { undo(); onClose(); } },
    { label: 'Redo', action: () => { redo(); onClose(); } },
    { label: 'Delete', action: () => { if (selectedNodeId) { deleteNode(selectedNodeId); onClose(); } }, danger: true },
  ];

  return (
    <div className="protota-context-menu" style={{
      position: 'fixed', left: x, top: y, zIndex: 3000,
      background: 'var(--popover-bg-color, #fff)', borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0,0,6,0.18)', border: '1px solid var(--separator-color)',
      minWidth: '160px', padding: '4px',
    }}>
      {items.map(item => (
        <div key={item.label} onClick={item.action} style={{
          padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
          color: item.danger ? 'var(--destructive-bg-color)' : 'inherit',
        }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--button-bg-color)'; }}
           onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
          {item.label}
        </div>
      ))}
    </div>
  );
};
