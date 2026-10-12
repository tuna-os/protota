import type { MockupDocument, AdwNode, ScreenTemplateType } from '../types/mockup';

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * HIG-compliant initial document.
 * Standard app window: AdwApplicationWindow → AdwToolbarView → [HeaderBar + content].
 */
export const initialDocument: MockupDocument = {
  id: 'doc-1',
  title: 'Untitled GNOME App',
  edges: [],
  colorScheme: 'auto',
  screens: [
    {
      id: 'screen-1',
      title: 'Main Window',
      type: 'standard',
      width: 800,
      height: 600,
      rootNode: {
        id: uid('root'),
        type: 'window',
        children: [
          {
            id: uid('toolbar'),
            type: 'toolbar-view',
            children: [
              {
                id: uid('hdr'),
                type: 'header-bar',
                title: 'My GNOME App',
                children: [
                  { id: uid('title'), type: 'window-title', title: 'My GNOME App' },
                ],
              },
              {
                id: uid('content'),
                type: 'box',
                orientation: 'vertical',
                spacing: 12,
                children: [
                  {
                    id: uid('clamp'),
                    type: 'clamp',
                    children: [
                      {
                        id: uid('label'),
                        type: 'label',
                        title: 'Welcome to your mockup. Select widgets from the palette to build your UI.',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
};

/**
 * True while the pristine starter template (the "Main Window / My GNOME App"
 * document) is on screen. Every mutation goes through immer or a spread, and
 * every persisted/imported document is rebuilt by blueprintToDocument, so a
 * plain reference check is enough — undoing all the way back to history[0]
 * legitimately counts as "starter" again. The shell's panel auto-close rules
 * (App.tsx) key off this.
 */
export const isStarterDocument = (doc: MockupDocument): boolean => doc === initialDocument;

/**
 * Create a HIG-compliant root node tree for each screen template type.
 */
export function createRootNode(type: ScreenTemplateType, title: string): AdwNode {
  switch (type) {
    // === Standard app window (from layout-recipes.md §5.2) ===
    case 'standard':
      return {
        id: uid('root'), type: 'window',
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar', title,
              children: [{ id: uid('title'), type: 'window-title', title }],
            },
            { id: uid('content'), type: 'box', orientation: 'vertical', spacing: 12,
              children: [{
                id: uid('clamp'), type: 'clamp',
                children: [{ id: uid('label'), type: 'label', title: 'Add content here.' }],
              }],
            },
          ],
        }],
      };

    // === ViewSwitcher app (from layout-recipes.md §5.3) ===
    case 'view-switcher':
      return {
        id: uid('root'), type: 'window',
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar',
              children: [{ id: uid('switcher'), type: 'view-switcher' }],
            },
            { id: uid('stack'), type: 'view-stack',
              children: [
                { id: uid('page1'), type: 'box', orientation: 'vertical', spacing: 12,
                  children: [{ id: uid('c1'), type: 'clamp',
                    children: [{ id: uid('l1'), type: 'label', title: 'First View' }],
                  }],
                },
                { id: uid('page2'), type: 'box', orientation: 'vertical', spacing: 12,
                  children: [{ id: uid('c2'), type: 'clamp',
                    children: [{ id: uid('l2'), type: 'label', title: 'Second View' }],
                  }],
                },
              ],
            },
          ],
        }],
      };

    // === Preferences dialog (from layout-recipes.md §5.1) ===
    case 'preferences':
      return {
        id: uid('root'), type: 'preferences-dialog', title,
        children: [{
          id: uid('page'), type: 'preferences-page', title: 'General',
          iconName: 'preferences-system-symbolic',
          children: [{
            id: uid('group'), type: 'preferences-group',
            title: 'Behaviour', description: 'Configure app behaviour.',
            children: [
              { id: uid('switch1'), type: 'switch-row', title: 'Enable Feature', subtitle: 'Turns on core functionality', active: true },
              { id: uid('combo1'), type: 'combo-row', title: 'Theme', subtitle: 'Select appearance' },
            ],
          }],
        }],
      };

    // === Sidebar app ===
    case 'sidebar':
      return {
        id: uid('root'), type: 'window',
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar',
              children: [{ id: uid('title'), type: 'window-title', title }],
            },
            { id: uid('split'), type: 'overlay-split',
              children: [
                { id: uid('sidebar'), type: 'box', orientation: 'vertical', spacing: 6,
                  children: [
                    { id: uid('sbtn1'), type: 'button', title: 'Item 1', flat: true },
                    { id: uid('sbtn2'), type: 'button', title: 'Item 2', flat: true },
                  ],
                },
                { id: uid('main-content'), type: 'clamp',
                  children: [{ id: uid('l3'), type: 'label', title: 'Select an item from the sidebar.' }],
                },
              ],
            },
          ],
        }],
      };

    // === Modal dialog ===
    case 'dialog':
      return {
        id: uid('root'), type: 'dialog', title,
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar', title },
            { id: uid('body'), type: 'box', orientation: 'vertical', spacing: 18,
              children: [
                { id: uid('msg'), type: 'label', title: 'Dialog content goes here.' },
                { id: uid('actions'), type: 'box', orientation: 'horizontal', spacing: 6,
                  children: [
                    { id: uid('cancel'), type: 'button', title: 'Cancel', flat: true },
                    { id: uid('ok'), type: 'button', title: 'OK', suggested: true },
                  ],
                },
              ],
            },
          ],
        }],
      };

    // === Alert dialog (confirmation/error) ===
    case 'alert-dialog':
      return {
        id: uid('root'), type: 'alert-dialog',
        title: 'Are you sure?',
        description: 'This action cannot be undone.',
        children: [
          { id: uid('cancel'), type: 'button', title: 'Cancel', flat: true },
          { id: uid('confirm'), type: 'button', title: 'Delete', destructive: true },
        ],
      };

    // === About dialog ===
    case 'about':
      return {
        id: uid('root'), type: 'about-dialog',
        title, description: 'A GNOME application',
        iconName: 'application-x-executable',
      };

    // === Status page (empty/error/loading) ===
    case 'status-page':
      return {
        id: uid('root'), type: 'status-page',
        title: 'Nothing Here', description: 'Try adding content to get started.',
        iconName: 'system-search-symbolic',
        children: [
          { id: uid('action'), type: 'button', title: 'Get Started', suggested: true },
        ],
      };

    // === Blank canvas ===
    case 'empty':
      return {
        id: uid('root'), type: 'box', orientation: 'vertical', spacing: 12,
        children: [{ id: uid('label'), type: 'label', title: 'Blank canvas — add widgets.' }],
      };
  }
}
