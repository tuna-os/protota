import React, { useEffect, useMemo, useRef } from "react";
import { useMockupStore } from "../store/mockupStore";
import {
  sidebarShowSymbolic,
  editUndoSymbolic,
  editRedoSymbolic,
  sidebarShowRightSymbolic,
  toolsCheckSpellingSymbolic,
} from "@gjsify/adwaita-icons/actions";
import { panDownSymbolic, focusLegacySystraySymbolic } from "@gjsify/adwaita-icons/ui";
import { folderOpenSymbolic } from "@gjsify/adwaita-icons/status";
import { documentSendSymbolic } from "@gjsify/adwaita-icons/actions";
import type { AdwMenuItem } from "@gjsify/adwaita-web";
import { exportDocumentFile } from "../utils/exportImport";
import { iconStyle } from "../utils/iconStyles";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMenus, IMPORT_FILE_INPUT_ID, type MenuItem } from "./MenuData";
import { AppMenuButton } from "./AppMenuButton";

interface HeaderProps {
  leftOpen: boolean;
  onToggleLeft: () => void;
  rightOpen: boolean;
  onToggleRight: () => void;
}

type AdwMenuButtonElement = HTMLElement & {
  menuItems: AdwMenuItem[];
  menuTitle: string;
};

const chevronStyle = iconStyle(panDownSymbolic);

/**
 * A labelled <adw-menu-button>: a text trigger with a trailing pan-down
 * chevron, reusing the compiled skin's popover surface and modelbutton rows.
 * The element's flat {id,label} item model cannot carry separators or
 * shortcuts, so they are post-rendered into the popover (the same bridge as
 * AppMenuButton); arrow-key navigation skips them because only
 * .adw-menu-button-item buttons are roving-tabindex'd. Click-to-toggle,
 * outside-click dismissal, Escape→trigger focus and ArrowUp/Down navigation
 * are the element's own private handlers.
 *
 * On mobile (<=768px) the trigger is icon-only — a symbolic icon instead of
 * the text label + chevron — so the compact header fits the viewport (#99).
 */
const LabeledMenuButton: React.FC<{
  label: string;
  items: MenuItem[];
  testId: string;
  icon?: string;
  tooltip?: string;
}> = ({ label, items, testId, icon, tooltip }) => {
  const btnRef = useRef<AdwMenuButtonElement>(null);
  /** Latest id→action map, read by the (once-registered) activation listener. */
  const actionsRef = useRef<Record<string, () => void>>({});

  // Activation comes back as a bubbling menu-item-activated CustomEvent with
  // {id,label,index} — the element's flat model cannot carry callbacks.
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const onActivate = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (typeof id === "string") actionsRef.current[id]?.();
    };
    el.addEventListener("menu-item-activated", onActivate);
    return () => el.removeEventListener("menu-item-activated", onActivate);
  }, []);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;

    // Flatten into the element's item model, recording where separators and
    // shortcuts belong, and map every item's id back to its action.
    const flatItems: AdwMenuItem[] = [];
    const dividerAfter: number[] = [];
    const shortcuts: Record<string, string> = {};
    const actions: Record<string, () => void> = {};
    for (const item of items) {
      if (item.divider) {
        if (flatItems.length > 0) dividerAfter.push(flatItems.length - 1);
      } else {
        flatItems.push({ id: item.label, label: item.label });
        if (item.action) actions[item.label] = item.action;
        if (item.shortcut) shortcuts[item.label] = item.shortcut;
      }
    }
    actionsRef.current = actions;

    // Setting menuItems always rebuilds the popover from scratch, which keeps
    // this effect idempotent under StrictMode double-invocation. menuTitle is
    // deliberately left unset: setting it re-renders the trigger button and
    // wipes the label + chevron injected below.
    el.menuItems = flatItems;

    // Trigger: bold text label + trailing chevron (desktop), or the symbolic
    // icon alone (mobile) — flush against the label, matching the other
    // header icon buttons' 34px size.
    const btn = el.querySelector<HTMLButtonElement>(".adw-menu-button-button");
    if (btn) {
      btn.replaceChildren();
      if (icon) {
        const iconEl = document.createElement("span");
        iconEl.className = "adw-toolbar-icon";
        Object.assign(iconEl.style, iconStyle(icon));
        btn.append(iconEl);
      } else {
        const labelEl = document.createElement("span");
        labelEl.className = "adw-menu-button-button-label";
        labelEl.textContent = label;
        const chevron = document.createElement("span");
        chevron.className = "adw-menu-button-button-chevron";
        chevron.setAttribute("aria-hidden", "true");
        Object.assign(chevron.style, chevronStyle);
        btn.append(labelEl, chevron);
      }
      // The element derives the trigger's aria-label from menu-title; these
      // are labelled buttons, so keep the visible text as the name.
      btn.setAttribute("aria-label", label);
      if (tooltip) btn.setAttribute("title", tooltip);
    }

    // Separators + right-aligned shortcuts into the compiled popover rows.
    const pop = el.querySelector(".adw-menu-button-popover");
    if (!pop) return;
    const itemNodes = Array.from(pop.querySelectorAll(".adw-menu-button-item"));
    for (const idx of dividerAfter) {
      const sep = document.createElement("div");
      sep.className = "protota-menu-divider";
      itemNodes[idx]?.after(sep);
    }
    itemNodes.forEach((node, i) => {
      const shortcut = shortcuts[flatItems[i]?.label ?? ""];
      if (shortcut) {
        const sc = document.createElement("span");
        sc.className = "adw-menu-button-item-shortcut";
        sc.textContent = shortcut;
        node.appendChild(sc);
      }
    });
  }, [items, label, icon]);

  return <adw-menu-button ref={btnRef} data-testid={testId} />;
};

/** A 34×34 flat header icon button (Layers, Undo/Redo, Flows, Diagnostics, Properties). */
const HeaderIconButton: React.FC<{
  icon: string;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  className?: string;
  active?: boolean;
  testId?: string;
  children?: React.ReactNode;
}> = ({ icon, onClick, title, ariaLabel, className = "", active, testId, children }) => (
  <button
    className={`adw-button flat protota-header-icon-button${active ? " active" : ""}${className ? ` ${className}` : ""}`}
    data-active={active ? "true" : undefined}
    onClick={onClick}
    title={title}
    aria-label={ariaLabel}
    data-testid={testId}
    style={children ? { position: "relative" } : undefined}
  >
    <span className="adw-toolbar-icon" style={iconStyle(icon)} />
    {children}
  </button>
);

/**
 * The app's adw-header-bar. Start slot: Layers toggle + the labelled "Open"
 * menu button + Undo/Redo. End slot: the labelled "Export" menu button
 * (the former share/export/PNG header buttons, consolidated) + the
 * Flows/Diagnostics toolbar buttons (desktop-only, icon-only) + the app-menu
 * button (theme switcher + overflow) + the Properties toggle. Open/Export
 * render on every viewport — the old menu bar and the mobile-only hamburger
 * integration are gone.
 */
export const Header: React.FC<HeaderProps> = ({
  leftOpen,
  onToggleLeft,
  rightOpen,
  onToggleRight,
}) => {
  const { doc, undo, redo, clearCanvas, showFlows, toggleShowFlows, diagnosticsEnabled } =
    useMockupStore();
  const { countable, errorCount, handleToggleDiagnostics } = useMenus();
  const isMobile = useIsMobile();

  // "Open" — project + import actions.
  const openMenuItems = useMemo<MenuItem[]>(
    () => [
      { label: "New Project", action: clearCanvas },
      {
        label: "Load Preset",
        action: () => window.dispatchEvent(new CustomEvent("protota:show-presets")),
      },
      { label: "divider", divider: true },
      {
        label: "Import...",
        action: () => document.getElementById(IMPORT_FILE_INPUT_ID)?.click(),
        shortcut: "Ctrl+I",
      },
      {
        label: "Import App...",
        action: () => window.dispatchEvent(new CustomEvent("protota:show-import-app")),
      },
    ],
    [clearCanvas],
  );

  // "Export" — the header's former end-slot actions, consolidated.
  const exportMenuItems = useMemo<MenuItem[]>(
    () => [
      {
        label: "Export Code...",
        action: () => window.dispatchEvent(new CustomEvent("protota:code-export")),
      },
      {
        label: "Export to Blueprint",
        action: () => window.dispatchEvent(new CustomEvent("protota:export-blueprint")),
        shortcut: "Ctrl+E",
      },
      {
        label: "Patch into Checkout...",
        action: () => window.dispatchEvent(new CustomEvent("protota:show-writeback")),
      },
      { label: "divider", divider: true },
      { label: "Export to JSON", action: () => exportDocumentFile(doc) },
      {
        label: "Export Screen to PNG",
        action: () => window.dispatchEvent(new CustomEvent("protota:export-png")),
      },
      { label: "divider", divider: true },
      {
        label: "Share URL",
        action: () => window.dispatchEvent(new CustomEvent("protota:share")),
        shortcut: "Ctrl+S",
      },
    ],
    [doc],
  );

  return (
    <adw-header-bar slot="top" data-testid="app-header-bar">
      {/* Start slot: Layers toggle + Open menu + Undo/Redo */}
      <div slot="start" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <HeaderIconButton
          icon={sidebarShowSymbolic}
          onClick={onToggleLeft}
          title="Toggle Layers Panel (Ctrl+[)"
          ariaLabel="Toggle Layers"
          active={leftOpen}
        />
        <LabeledMenuButton
          label="Open"
          items={openMenuItems}
          testId="open-menu-button"
          icon={isMobile ? folderOpenSymbolic : undefined}
          tooltip={isMobile ? "Open or Create" : undefined}
        />
        <HeaderIconButton
          icon={editUndoSymbolic}
          onClick={undo}
          title="Undo (Ctrl+Z)"
          ariaLabel="Undo"
        />
        <HeaderIconButton
          icon={editRedoSymbolic}
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
          ariaLabel="Redo"
        />
      </div>
      {/* End slot: Export menu + Flows/Diagnostics + app-menu button + Properties toggle */}
      <div slot="end" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <LabeledMenuButton
          label="Export"
          items={exportMenuItems}
          testId="export-menu-button"
          icon={isMobile ? documentSendSymbolic : undefined}
          tooltip={isMobile ? "Export" : undefined}
        />
        {!isMobile && (
          <>
            <HeaderIconButton
              icon={focusLegacySystraySymbolic}
              onClick={toggleShowFlows}
              title="Toggle Screen Flows (Ctrl+;)"
              ariaLabel="Flows"
              active={showFlows}
            />
            {/* The @gjsify/adwaita-icons package does not ship diagnostics-symbolic
                (upstream development category); the design's sanctioned fallback is
                the spell-check icon (design §5.2). */}
            <HeaderIconButton
              icon={toolsCheckSpellingSymbolic}
              onClick={handleToggleDiagnostics}
              ariaLabel="Diagnostics"
              title={`Toggle Diagnostics${countable.length ? `: ${countable.length} issues` : ""} (Ctrl+')`}
              active={diagnosticsEnabled}
              testId="diagnostics-toggle"
            >
              {diagnosticsEnabled && countable.length > 0 && (
                <span
                  data-testid="diagnostics-badge"
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    fontSize: "10px",
                    fontWeight: 700,
                    minWidth: "16px",
                    padding: "0 4px",
                    borderRadius: "8px",
                    textAlign: "center",
                    color: "#fff",
                    background: errorCount > 0
                      ? "var(--destructive-bg-color, #e01b24)"
                      : "var(--dim-fg-color, rgba(0,0,6,0.55))",
                  }}
                >
                  {countable.length}
                </span>
              )}
            </HeaderIconButton>
          </>
        )}
        <AppMenuButton />
        <HeaderIconButton
          icon={sidebarShowRightSymbolic}
          onClick={onToggleRight}
          title="Toggle Properties Panel (Ctrl+])"
          ariaLabel="Toggle Properties"
          active={rightOpen}
        />
      </div>
    </adw-header-bar>
  );
};
