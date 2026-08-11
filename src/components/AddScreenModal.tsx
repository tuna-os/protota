import React, { useEffect, useRef, useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { ScreenTemplateType } from '../types/mockup';
import { SCREEN_DEFAULTS } from '../types/mockup';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATES: { value: ScreenTemplateType; label: string; desc: string }[] = [
  {
    value: 'standard',
    label: 'Standard App Window',
    desc: 'ToolbarView + HeaderBar + content area. The default GNOME app window.',
  },
  {
    value: 'view-switcher',
    label: 'View Switcher App',
    desc: 'HeaderBar with ViewSwitcher tabs (3-5) + ViewStack. Flat page switching.',
  },
  {
    value: 'sidebar',
    label: 'Sidebar + Content',
    desc: 'OverlaySplitView with sidebar navigation and a content area.',
  },
  {
    value: 'preferences',
    label: 'Preferences Dialog',
    desc: 'AdwPreferencesDialog with search + PreferencesPage/Group structure.',
  },
  {
    value: 'dialog',
    label: 'Modal Dialog',
    desc: 'A modal dialog with HeaderBar, content, and action buttons.',
  },
  {
    value: 'alert-dialog',
    label: 'Alert / Confirmation Dialog',
    desc: 'AdwAlertDialog for confirmations, errors, or destructive actions.',
  },
  {
    value: 'about',
    label: 'About Dialog',
    desc: 'AdwAboutDialog with app metadata, version, and credits.',
  },
  {
    value: 'status-page',
    label: 'Status / Empty Page',
    desc: 'AdwStatusPage — empty state, error, or loading placeholder.',
  },
  {
    value: 'empty',
    label: 'Blank Canvas',
    desc: 'An empty box. Build from scratch.',
  },
];

export const AddScreenModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addScreen } = useMockupStore();
  const [title, setTitle] = useState('New Screen');
  const [template, setTemplate] = useState<ScreenTemplateType>('standard');
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      (el as any).present?.();
    }
  }, [isOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener('closed', handler);
    return () => el.removeEventListener('closed', handler);
  }, [onClose]);

  if (!isOpen) return null;

  const defaults = SCREEN_DEFAULTS[template];

  const handleCreate = () => {
    addScreen(title, template);
    onClose();
  };

  return (
    <adw-dialog
      ref={dialogRef}
      title="Add Screen — GNOME HIG Template"
      content-width={480}
      can-close=""
    >
      <div style={{ padding: '0 24px 24px' }}>
        <p style={{ fontSize: '12px', opacity: 0.65, marginBottom: '16px' }}>
          Each template scaffolds a HIG-compliant widget tree. Legal nesting is enforced.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0' }}>
          <div>
            <label className="protota-field-label" style={{ marginBottom: '4px', display: 'block' }}>
              Screen Title
            </label>
            <input
              type="text"
              className="protota-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="protota-field-label" style={{ marginBottom: '4px', display: 'block' }}>
              Template
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflow: 'auto' }}>
              {TEMPLATES.map((t) => (
                <label
                  key={t.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: template === t.value ? 'var(--accent-bg-color, #3584e4)' : 'var(--button-bg-color, rgba(0,0,6,0.08))',
                    color: template === t.value ? 'var(--accent-fg-color, #fff)' : 'inherit',
                  }}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.value}
                    checked={template === t.value}
                    onChange={(e) => setTemplate(e.target.value as ScreenTemplateType)}
                    style={{ marginTop: '2px', accentColor: 'var(--accent-bg-color, #3584e4)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                      {t.desc} — {defaults.width}×{defaults.height}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="protota-btn" onClick={onClose}>Cancel</button>
          <button className="protota-btn protota-btn--primary" onClick={handleCreate}>
            Create Screen
          </button>
        </div>
      </div>
    </adw-dialog>
  );
};
