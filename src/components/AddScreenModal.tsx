import React, { useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { ScreenTemplateType } from '../store/mockupStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddScreenModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addScreen } = useMockupStore();
  const [title, setTitle] = useState('New Screen');
  const [template, setTemplate] = useState<ScreenTemplateType>('window');

  if (!isOpen) return null;

  const handleCreate = () => {
    addScreen(title, template);
    onClose();
  };

  return (
    <div className="adwmock-modal-backdrop" onClick={onClose}>
      <div className="adwmock-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Add Top-Level Surface</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0' }}>
          <div>
            <label className="adwmock-field-label" style={{ marginBottom: '4px', display: 'block' }}>
              Screen Title
            </label>
            <input
              type="text"
              className="adwmock-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="adwmock-field-label" style={{ marginBottom: '4px', display: 'block' }}>
              Surface Template
            </label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as ScreenTemplateType)}
              className="adwmock-input"
              style={{ width: '100%' }}
            >
              <option value="window">Standard Window (1024×720)</option>
              <option value="dialog">Dialog Surface (600×500)</option>
              <option value="preferences">Preferences Window (800×600)</option>
              <option value="status-page">Status / Empty State Page (400×500)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="adwmock-btn" onClick={onClose}>Cancel</button>
          <button className="adwmock-btn adwmock-btn--primary" onClick={handleCreate}>
            Create Screen
          </button>
        </div>
      </div>
    </div>
  );
};
