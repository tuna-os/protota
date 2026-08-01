/** Type surface of scripts/round-trip-lib.mjs for TypeScript consumers (tests). */
import type { MockupDocument, AdwNode } from '../src/types/mockup';
import type { BlueprintSourceFile } from '../src/utils/blueprint';

export { blueprintBundleToDocument } from '../src/utils/blueprint';

export interface DiscoveryResult {
  sourceRoot: string;
  files: BlueprintSourceFile[];
  codeFiles: BlueprintSourceFile[];
  discovery: string;
  notes: string[];
}
export function discoverSources(sourceRoot: string): DiscoveryResult;

export interface BundleManifest {
  entryCandidates: string[];
  parseIssues: { path: string; message: string }[];
  unresolvedReferences: string[];
  declaredTemplates: string[];
}
export function bundleManifest(files: BlueprintSourceFile[]): BundleManifest;

export interface CstProp {
  name: string;
  start: number;
  valueStart: number;
  valueEnd: number;
  end: number;
}
export interface CstNode {
  className: string;
  id: string | null;
  isTemplate: boolean;
  templateName: string | null;
  slot: string | null;
  depth: number;
  start: number;
  bodyStart: number;
  closeBrace: number;
  end: number;
  props: CstProp[];
  styles: { start: number; listStart: number; listEnd: number; end: number; entries: string[] } | null;
  layout: { start: number; bodyStart: number; end: number; props: CstProp[] } | null;
  children: CstNode[];
}
export function parseBlueprintCst(text: string): { roots: CstNode[]; templates: CstNode[] };

export function indexBundleCst(files: BlueprintSourceFile[]): {
  csts: Map<string, { roots: CstNode[]; templates: CstNode[]; text: string }>;
  templates: Map<string, { path: string; node: CstNode }>;
  idIndex: Map<string, { path: string; node: CstNode }[]>;
};

export interface DocumentEdit {
  kind: 'set' | 'unset' | 'styles' | 'insert' | 'remove';
  target?: AdwNode;
  editedNode?: AdwNode;
  key?: string;
  value?: unknown;
  parent?: AdwNode;
  node?: AdwNode;
  child?: AdwNode;
  followingIds?: string[];
}
export function diffDocuments(original: MockupDocument, edited: MockupDocument): {
  edits: DocumentEdit[];
  unsupported: string[];
};

export function planWriteback(options: {
  files: BlueprintSourceFile[];
  entry: string;
  editedDocument: MockupDocument;
}): {
  original: MockupDocument;
  edits: DocumentEdit[];
  unsupported: string[];
  changedFiles: Map<string, string>;
  touched: { path: string; label: string }[];
};

export function unifiedDiff(before: string, after: string, path: string): string;

export interface BlueprintCompiler {
  kind: 'shell' | 'exec';
  label: string;
  command: string | string[];
}
export function resolveBlueprintCompiler(options?: { explicit?: string | null; sourceRoot?: string }): BlueprintCompiler | null;
export function compileBlueprintFile(compiler: BlueprintCompiler, filePath: string): { ok: boolean; output: string };

export function isDirectory(path: string): boolean;
