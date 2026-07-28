import React, { useRef, useEffect } from 'react';
import type { AdwNode } from '../types/mockup';
import { LEGAL_CHILDREN } from '../types/mockup';
import { useMockupStore } from '../store/mockupStore';

interface Props {
  node: AdwNode;
  screenId: string;
  screenWidth?: number;
  screenHeight?: number;
}

function nodeProps(node: AdwNode): Record<string, string> {
  const p: Record<string, string> = {};
  switch (node.type) {
    case 'adw-window': break;
    case 'adw-header-bar': if (node.title) p.title = node.title; break;
    case 'adw-action-row':
      if (node.title) p.title = node.title;
      if (node.subtitle) p.subtitle = node.subtitle;
      if (node.activatable) p.activatable = '';
      break;
    case 'adw-combo-row':
      if (node.title) p.title = node.title;
      if (node.subtitle) p.subtitle = node.subtitle;
      break;
    case 'adw-preferences-page':
      if (node.title) p.title = node.title;
      if (node.iconName) p['icon-name'] = node.iconName;
      break;
    case 'adw-preferences-group':
      if (node.title) p.title = node.title;
      if (node.description) p.description = node.description;
      break;
    case 'adw-status-page':
      if (node.title) p.title = node.title;
      if (node.description) p.description = node.description;
      if (node.iconName) p.icon = node.iconName;
      break;
    case 'adw-button':
      if (node.title) p.label = node.title;
      if (node.iconName) p.icon = node.iconName;
      if (node.suggested) p.suggested = '';
      if (node.destructive) p.destructive = '';
      break;
    case 'adw-entry':
      if (node.title) p.value = node.title;
      if (node.placeholder) p.placeholder = node.placeholder;
      break;
  }
  return p;
}

export const AdwaitaRenderer: React.FC<Props> = ({
  node, screenId, screenWidth, screenHeight,
}) => {
  const { selectedNodeId, selectNode, addChildNode, updateNodeProps } = useMockupStore();
  const isSelected = selectedNodeId === node.id;
  const legalAdds = LEGAL_CHILDREN[node.type] || [];
  const elRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (node.type === 'adw-window' && elRef.current && screenWidth) {
      elRef.current.style.width = `${screenWidth}px`;
      if (screenHeight) elRef.current.style.height = `${screenHeight}px`;
    }
  }, [node.type, screenWidth, screenHeight]);

  const tag = node.type;
  const attrs = nodeProps(node);

  const children = node.children?.map((child) => (
    <AdwaitaRenderer key={child.id} node={child} screenId={screenId} />
  ));

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, screenId);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const textFields = ['adw-header-bar', 'adw-action-row', 'adw-combo-row',
      'adw-preferences-group', 'adw-status-page', 'adw-button'];
    if (!textFields.includes(node.type)) return;
    e.stopPropagation();

    const el = elRef.current;
    if (!el) return;

    const textEl = el.querySelector('.adw-header-bar-title, .adw-row-title, .adw-status-page-title, .adw-button') as HTMLElement;
    if (!textEl || !node.title) return;

    textEl.contentEditable = 'true';
    textEl.focus();

    const commit = () => {
      textEl.contentEditable = 'false';
      const newText = textEl.textContent?.trim() ?? '';
      if (newText && newText !== node.title) {
        updateNodeProps(node.id, { title: newText });
      }
    };

    textEl.onblur = commit;
    textEl.onkeydown = (ke: KeyboardEvent) => {
      if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
      if (ke.key === 'Escape') { textEl.textContent = node.title ?? ''; commit(); }
    };
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`adw-node-wrapper${isSelected ? ' selected-outline' : ''}`}
      style={{ position: 'relative' }}
    >
      {isSelected && (
        <div className="adwmock-type-badge">{node.type}</div>
      )}

      {React.createElement(tag, { ref: elRef, ...attrs }, ...(children ?? []))}

      {isSelected && legalAdds.length > 0 && (
        <div style={{ position: 'absolute', bottom: '-28px', left: '0', display: 'flex', gap: '4px', flexWrap: 'wrap', zIndex: 10 }}>
          {legalAdds.map((type) => (
            <button
              key={type}
              className="adwmock-add-btn"
              onClick={(e) => { e.stopPropagation(); addChildNode(node.id, type); }}
            >
              + {type.replace('adw-', '')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
