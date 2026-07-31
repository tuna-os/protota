/**
 * Protota Agent API — Builder for programmatic mockup creation.
 *
 * Agents (pi, Claude Code, etc.) use this to generate HIG-compliant
 * .mockup.json files from natural language feature descriptions.
 *
 * Usage:
 *   import { MockupBuilder } from './agent-api';
 *   const doc = new MockupBuilder('My GNOME App')
 *     .addScreen('standard', 'Main Window')
 *     .addWidget('toolbar-view')
 *     .addChild('header-bar', { title: 'My App' })
 *     .build();
 */

import type { MockupDocument, AdwNode, AdwNodeType, ScreenTemplateType } from '../types/mockup';
import { LEGAL_CHILDREN, LEGAL_SLOTS, SCREEN_DEFAULTS } from '../types/mockup';
import { blueprintBundleToDocument, type BlueprintSourceFile } from './blueprint';
import { discoverAppSources, appBundleManifest, type AppFileMap } from './appDiscovery';
import { fetchGitArchive } from './appIngest';

let _nextId = 0;
function uid(): string {
  return `agent-${Date.now()}-${_nextId++}`;
}

export class MockupBuilder {
  private doc: MockupDocument;
  private _stack: AdwNode[] = [];

  constructor(title: string) {
    this.doc = {
      id: uid(),
      title,
      colorScheme: 'auto',
      edges: [],
      screens: [],
    };
  }

  /** Add a new screen and set it as the current context. */
  addScreen(type: ScreenTemplateType, title: string): this {
    const defaults = SCREEN_DEFAULTS[type];
    const TEMPLATE_ROOT: Record<ScreenTemplateType, AdwNodeType> = {
      standard: 'window', 'view-switcher': 'window', preferences: 'preferences-dialog',
      sidebar: 'window', dialog: 'dialog', 'alert-dialog': 'alert-dialog',
      about: 'about-dialog', 'status-page': 'status-page', empty: 'box',
    };
    const rootNode: AdwNode = {
      id: uid(),
      type: TEMPLATE_ROOT[type] || 'window',
      children: [],
    };
    this.doc.screens.push({
      id: uid(),
      title,
      type,
      width: defaults.width,
      height: defaults.height,
      rootNode,
    });
    this._stack = [rootNode];
    return this;
  }

  /** Add a widget as a child of the current stack top. */
  addWidget(type: AdwNodeType, props?: Partial<AdwNode>): this {
    const parent = this._stack[this._stack.length - 1];
    if (!parent) throw new Error('No parent context. Call addScreen first.');
    if (!parent.children) parent.children = [];

    const legal = LEGAL_CHILDREN[parent.type] || [];
    if (!legal.includes(type)) {
      throw new Error(`"${type}" is not a legal child of "${parent.type}". Legal: ${legal.join(', ')}`);
    }

    // GNOME layout is slot-driven: a button in a header bar's `start` is a
    // different thing from one in its `end`. Reject a slot the container does
    // not offer rather than silently placing the widget somewhere else.
    const slot = props?.slot;
    const slots = LEGAL_SLOTS[parent.type];
    if (slot && slots && !slots.includes(slot)) {
      throw new Error(`"${slot}" is not a slot of "${parent.type}". Slots: ${slots.join(', ')}`);
    }

    const node: AdwNode = {
      id: uid(),
      type,
      ...props,
      children: [],
    };
    parent.children.push(node);
    this._stack.push(node);
    return this;
  }

  /** Named slots the given container offers, for agents choosing placement. */
  static slotsFor(type: AdwNodeType): string[] {
    return LEGAL_SLOTS[type] ?? [];
  }

  /** Widgets the given container legally accepts. */
  static childrenFor(type: AdwNodeType): AdwNodeType[] {
    return LEGAL_CHILDREN[type] ?? [];
  }

  /** Navigate into a child container to add nested widgets. */
  addChild(type: AdwNodeType, props?: Partial<AdwNode>): this {
    return this.addWidget(type, props);
  }

  /** Pop back to parent container. */
  up(): this {
    if (this._stack.length <= 1) throw new Error('Already at root level.');
    this._stack.pop();
    return this;
  }

  /** Return to root node of current screen. */
  root(): this {
    this._stack = [this._stack[0]];
    return this;
  }

  /** Set document-level properties. */
  setProps(props: Partial<Pick<MockupDocument, 'colorScheme' | 'title' | 'edges'>>): this {
    Object.assign(this.doc, props);
    return this;
  }

  /** Continue building from an existing document (e.g. a loaded preset). */
  static fromDocument(doc: MockupDocument): MockupBuilder {
    const builder = new MockupBuilder(doc.title);
    builder.doc = JSON.parse(JSON.stringify(doc));
    const lastScreen = builder.doc.screens[builder.doc.screens.length - 1];
    builder._stack = lastScreen ? [lastScreen.rootNode] : [];
    return builder;
  }

  /**
   * Import screens from official Blueprint/GtkBuilder source — the same
   * pipeline the preset generator uses (template linking, Vala enrichment
   * when .vala files are supplied, honest custom-widget boundaries).
   */
  importScreens(files: BlueprintSourceFile[], entryPath: string, options?: { title?: string; width?: number; height?: number }): this {
    const imported = blueprintBundleToDocument(files, entryPath, options?.title ?? this.doc.title);
    for (const screen of imported.screens) {
      if (options?.width) screen.width = options.width;
      if (options?.height) screen.height = options.height;
      this.doc.screens.push(screen);
    }
    const lastScreen = this.doc.screens[this.doc.screens.length - 1];
    if (lastScreen) this._stack = [lastScreen.rootNode];
    return this;
  }

  /**
   * Import a whole app checkout supplied as an abstract file map
   * (`{ path → text }`) — the same front door the Import App dialog uses
   * (#118). Discovery (gresource XML + meson.build, glob fallback) selects
   * the declarative sources; when `entry` is omitted it is inferred from the
   * single window-bearing candidate, and ambiguity fails loudly with the
   * candidate list instead of guessing.
   */
  importApp(files: AppFileMap, entry?: string, options?: { title?: string; width?: number; height?: number }): this {
    const discovered = discoverAppSources(files);
    if (!discovered.files.length) {
      throw new Error('importApp: no .blp or .ui files found in the supplied file map.');
    }
    const manifest = appBundleManifest(discovered.files);
    let entryPath = entry ?? null;
    if (entryPath && !discovered.files.some(file => file.path === entryPath)) {
      throw new Error(`importApp: entry "${entryPath}" is not among the discovered files: ${discovered.files.map(file => file.path).join(', ')}`);
    }
    if (!entryPath) {
      if (manifest.entryCandidates.length === 1) entryPath = manifest.entryCandidates[0];
      else if (manifest.entryCandidates.length) {
        throw new Error(`importApp: multiple entry candidates — pass entry. Candidates: ${manifest.entryCandidates.join(', ')}`);
      } else {
        throw new Error('importApp: no window-bearing file found — pass entry explicitly.');
      }
    }
    return this.importScreens(discovered.files, entryPath, options);
  }

  /**
   * Import an app straight from its forge URL (GitHub / GitLab incl.
   * gitlab.gnome.org / Codeberg): the ref archive is fetched client-side,
   * unpacked in-memory, and handed to {@link importApp}. Forges that block
   * cross-origin downloads fail with an actionable error.
   */
  async importAppFromUrl(gitUrl: string, ref?: string, options?: { entry?: string; title?: string; width?: number; height?: number }): Promise<this> {
    const { files } = await fetchGitArchive(gitUrl, ref);
    return this.importApp(files, options?.entry, options);
  }

  /** Resolve a screen by id or title. */
  private findScreen(idOrTitle: string) {
    return this.doc.screens.find(screen => screen.id === idOrTitle || screen.title === idOrTitle);
  }

  /**
   * Connect two screens with a navigation flow edge (#11), rendered as an
   * arrow on the canvas. Screens are matched by id or title.
   */
  connectScreens(from: string, to: string): this {
    const source = this.findScreen(from);
    const target = this.findScreen(to);
    if (!source || !target) throw new Error(`connectScreens: unknown screen "${!source ? from : to}"`);
    this.doc.edges.push({ id: uid(), sourceId: source.id, targetId: target.id });
    return this;
  }

  /**
   * Finishing-style override on any node by id: the same operation a
   * presets-src finishing file performs (hide runtime-hidden regions, pick a
   * visible stack page, set a mode label…).
   */
  overrideNode(nodeId: string, props: Partial<AdwNode>): this {
    let applied = false;
    const visit = (node: AdwNode) => {
      if (node.id === nodeId) { Object.assign(node, props); applied = true; }
      node.children?.forEach(visit);
    };
    this.doc.screens.forEach(screen => visit(screen.rootNode));
    if (!applied) throw new Error(`overrideNode: no node with id "${nodeId}"`);
    return this;
  }

  /** Validate against LEGAL_CHILDREN recursively. */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const walk = (node: AdwNode) => {
      if (!node.children) return;
      const legal = LEGAL_CHILDREN[node.type] || [];
      for (const child of node.children) {
        if (!legal.includes(child.type)) {
          errors.push(`${child.type} is not a legal child of ${node.type} (node: ${child.id})`);
        }
        walk(child);
      }
    };
    for (const screen of this.doc.screens) walk(screen.rootNode);
    return { valid: errors.length === 0, errors };
  }

  /** Build and return the final document. */
  build(): MockupDocument {
    return JSON.parse(JSON.stringify(this.doc));
  }
}

/**
 * One-shot builder: generate a mockup from a high-level description.
 * Example:
 *   const doc = generateMockup('Preferences', 'settings', {
 *     groups: [
 *       { title: 'Appearance', rows: ['switch:Dark Mode:Toggle dark theme', 'combo:Theme:Select theme'] },
 *       { title: 'Behaviour', rows: ['switch:Notifications:Enable desktop notifications'] },
 *     ],
 *   });
 */
export function generateMockup(
  title: string,
  type: ScreenTemplateType,
  opts?: { groups?: { title: string; rows: string[] }[] },
): MockupDocument {
  if (type === 'preferences' && opts?.groups) {
    const b = new MockupBuilder(title);
    b.addScreen('preferences', title);
    // preferences-dialog is the root, add preferences-page directly
    b.addWidget('preferences-page', { title: 'General' });
    for (const group of opts.groups) {
      b.addWidget('preferences-group', { title: group.title });
      for (const row of group.rows) {
        const parts = row.split(':');
        if (parts[0] === 'switch') {
          b.addWidget('switch-row', { title: parts[1], subtitle: parts[2] || '' });
        } else if (parts[0] === 'combo') {
          b.addWidget('combo-row', { title: parts[1], subtitle: parts[2] || '' });
        } else if (parts[0] === 'action') {
          b.addWidget('action-row', { title: parts[1], subtitle: parts[2] || '' });
        } else if (parts[0] === 'entry') {
          b.addWidget('entry-row', { title: parts[1], placeholder: parts[2] || '' });
        }
        b.up();
      }
      b.up();
    }
    return b.build();
  }

  const b = new MockupBuilder(title);
  b.addScreen(type, title);

  // Scaffold standard window structure
  b.addWidget('toolbar-view');
  b.addWidget('header-bar', { title });
  b.up();
  b.addWidget('box', { orientation: 'vertical', spacing: 12 });
  b.addWidget('clamp');
  b.addWidget('label', { title: 'Content goes here.' });

  return b.build();
}
