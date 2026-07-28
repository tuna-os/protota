import React from 'react';
import { useMockupStore } from '../store/mockupStore';

interface Props {
  nodeId: string;
}

export const NodeActions: React.FC<Props> = ({ nodeId }) => {
  const { moveNodeUp, moveNodeDown, deleteNode } = useMockupStore();

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button className="adwmock-btn" onClick={() => moveNodeUp(nodeId)} style={{ flex: 1, padding: '4px 6px', fontSize: '12px' }}>
        ▲ Up
      </button>
      <button className="adwmock-btn" onClick={() => moveNodeDown(nodeId)} style={{ flex: 1, padding: '4px 6px', fontSize: '12px' }}>
        ▼ Down
      </button>
      <button
        className="adwmock-btn adwmock-btn--destructive"
        onClick={() => deleteNode(nodeId)}
        style={{ padding: '4px 8px', fontSize: '12px' }}
        title="Delete"
      >🗑</button>
    </div>
  );
};
