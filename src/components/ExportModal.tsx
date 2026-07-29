import React, { useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { mockupToBlueprint } from '../utils/blueprint';
import { generatePythonBindings, generateRustBindings, generateValaBindings } from '../utils/codeGenerator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { doc } = useMockupStore();
  const [activeTab, setActiveTab] = useState<'blp' | 'python' | 'rust' | 'vala'>('blp');

  if (!isOpen) return null;

  const blpCode = mockupToBlueprint(doc);
  const pythonCode = generatePythonBindings(doc);
  const rustCode = generateRustBindings(doc);
  const valaCode = generateValaBindings(doc);

  const getActiveCode = () => {
    switch (activeTab) {
      case 'blp': return blpCode;
      case 'python': return pythonCode;
      case 'rust': return rustCode;
      case 'vala': return valaCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    alert('Code copied to clipboard!');
  };

  const handleDownload = () => {
    const code = getActiveCode();
    const ext = activeTab === 'blp' ? 'blp' : activeTab === 'python' ? 'py' : activeTab === 'rust' ? 'rs' : 'vala';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="protota-modal-backdrop" onClick={onClose}>
      <div className="protota-modal" onClick={(e) => e.stopPropagation()} style={{ width: '680px', maxHeight: '85vh' }}>
        <h3 style={{ marginTop: 0 }}>Export GTK4 / Libadwaita Code</h3>
        
        {/* Export Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--separator-color, rgba(0,0,6,0.12))', marginBottom: '12px' }}>
          <button
            className={`protota-btn ${activeTab === 'blp' ? 'suggested' : ''}`}
            onClick={() => setActiveTab('blp')}
          >
            Blueprint (.blp)
          </button>
          <button
            className={`protota-btn ${activeTab === 'python' ? 'suggested' : ''}`}
            onClick={() => setActiveTab('python')}
          >
            Python (PyGObject)
          </button>
          <button
            className={`protota-btn ${activeTab === 'rust' ? 'suggested' : ''}`}
            onClick={() => setActiveTab('rust')}
          >
            Rust (gtk4-rs)
          </button>
          <button
            className={`protota-btn ${activeTab === 'vala' ? 'suggested' : ''}`}
            onClick={() => setActiveTab('vala')}
          >
            Vala
          </button>
        </div>

        <pre style={{
          background: 'var(--card-bg-color, #1e1e1e)',
          color: '#f8f8f2',
          padding: '12px',
          borderRadius: '8px',
          maxHeight: '380px',
          overflow: 'auto',
          fontSize: '12px',
          fontFamily: 'monospace',
          lineHeight: '1.4'
        }}>
          {getActiveCode()}
        </pre>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button className="protota-btn" onClick={handleCopy}>Copy Code</button>
          <button className="protota-btn suggested" onClick={handleDownload}>Download File</button>
          <button className="protota-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
