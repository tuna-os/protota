import { createContext, useContext } from 'react';
import type { AdwNode } from '../types/mockup';

/**
 * Interactive preview mode (Figma-style prototype playback).
 *
 * When this context is non-null, AdwaitaRenderer renders for INTERACTION
 * instead of editing: selection/diagnostic chrome is suppressed, clicks act
 * on the mockup, and every state change is ephemeral — component state in
 * the preview overlay, never a document mutation, never an undo entry.
 */
export interface PreviewInteraction {
  /**
   * An activation tap (button, button-row, activatable action-row, list row).
   * Follows the current screen's outgoing flow edge, if it has one.
   */
  activate: (node: AdwNode) => void;
  /**
   * Merge an ephemeral render-time patch for a node (e.g. a stack's
   * visibleChildName when a view-switcher tab is tapped). Feeds the same
   * `overrides` channel as Adw.Breakpoint setters; the document is never
   * touched, and the patch dies with the preview.
   */
  setNodeState: (nodeId: string, patch: Partial<AdwNode>) => void;
}

export const PreviewContext = createContext<PreviewInteraction | null>(null);

/** Non-null only while rendering inside the full-screen preview overlay. */
export const usePreview = () => useContext(PreviewContext);
