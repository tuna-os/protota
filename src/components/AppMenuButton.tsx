import React, { useEffect, useRef } from "react";
import { objectSelectSymbolic, openMenuSymbolic } from "@gjsify/adwaita-icons/actions";
import { toDataUri } from "@gjsify/adwaita-icons/utils";
import { useMockupStore } from "../store/mockupStore";
import type { WindowButtonsPreference } from "../utils/headerBarChrome";
import { iconStyle } from "../utils/iconStyles";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMenus, type MenuItem } from "./MenuData";

type GtkPopoverElement = HTMLElement & {
  open: boolean;
  anchor: HTMLElement | null;
};

type ThemeChoice = "auto" | "light" | "dark";

const THEME_CHOICES: Array<{ choice: ThemeChoice; label: string; circleClass: string }> = [
  { choice: "auto", label: "Follow System Style", circleClass: "protota-swatch-system" },
  { choice: "light", label: "Light Style", circleClass: "protota-swatch-light" },
  { choice: "dark", label: "Dark Style", circleClass: "protota-swatch-dark" },
];

/** objectSelectSymbolic as a mask URI — the white check in the selected badge. */
const checkUri = toDataUri(objectSelectSymbolic);

/**
 * Build the 3-circle theme switcher (GNOME Settings appearance idiom) as DOM.
 * Apply 3px accent ring on selected swatch circle rim.
 */
function buildThemeSwitcher(onChoose: (choice: ThemeChoice) => void): HTMLElement {
  const group = document.createElement("div");
  group.className = "protota-theme-switcher protota-theme-switcher-popover";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Theme style");
  for (const { choice, label, circleClass } of THEME_CHOICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "protota-theme-swatch";
    btn.dataset.themeChoice = choice;
    btn.title = label;
    btn.setAttribute("aria-label", label);
    const circle = document.createElement("span");
    circle.className = `protota-swatch-circle ${circleClass}`;
    circle.setAttribute("aria-hidden", "true");
    const check = document.createElement("span");
    check.className = "protota-theme-check";
    check.setAttribute("aria-hidden", "true");
    const checkIcon = document.createElement("span");
    checkIcon.className = "protota-theme-check-icon";
    checkIcon.style.maskImage = checkUri;
    checkIcon.style.webkitMaskImage = checkUri;
    checkIcon.style.maskSize = "contain";
    checkIcon.style.webkitMaskSize = "contain";
    check.appendChild(checkIcon);
    btn.append(circle, check);
    btn.addEventListener("click", () => onChoose(choice));
    group.appendChild(btn);
  }
  return group;
}

/** Drive the selected state on class -> aria-pressed -> inline styles,
 * verifying against CSS selector/stacking issues. */
function syncThemeSwitcher(group: HTMLElement, selected: string): void {
  group.querySelectorAll<HTMLElement>(".protota-theme-swatch").forEach((swatch) => {
    const on = swatch.dataset.themeChoice === selected;
    swatch.classList.toggle("selected", on);
    swatch.setAttribute("aria-pressed", String(on));
    const circle = swatch.querySelector<HTMLElement>(".protota-swatch-circle");
    if (circle) circle.style.boxShadow = on ? "inset 0 0 0 3px var(--accent-color, #3584e4)" : "";
    const check = swatch.querySelector<HTMLElement>(".protota-theme-check");
    if (check) check.style.display = on ? "flex" : "";
  });
}

/**
 * The window-buttons preference picker (#163): two segmented rows — which
 * buttons (Full / Close only) and where they sit (End / Start). Options carry
 * aria-pressed and a `.selected` class so selection survives any CSS stacking.
 */
const BUTTON_CHOICES: Array<{ value: WindowButtonsPreference['buttons']; label: string }> = [
  { value: "window", label: "Full" },
  { value: "close", label: "Close only" },
];
const SIDE_CHOICES: Array<{ value: WindowButtonsPreference['side']; label: string }> = [
  { value: "end", label: "End" },
  { value: "start", label: "Start" },
];

function buildWindowButtonsPicker(
  onButtons: (buttons: WindowButtonsPreference['buttons']) => void,
  onSide: (side: WindowButtonsPreference['side']) => void,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "protota-window-buttons-picker protota-window-buttons-picker-popover";
  section.setAttribute("role", "group");
  section.setAttribute("aria-label", "Window buttons");

  const row = (title: string, ariaLabel: string, choices: Array<{ value: string; label: string }>, onPick: (value: string) => void) => {
    const rowEl = document.createElement("div");
    rowEl.className = "protota-window-buttons-row";
    const caption = document.createElement("span");
    caption.className = "protota-window-buttons-caption";
    caption.textContent = title;
    rowEl.appendChild(caption);
    const seg = document.createElement("div");
    seg.className = "protota-window-buttons-segment";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", ariaLabel);
    for (const { value, label } of choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "protota-window-buttons-option";
      btn.dataset.value = value;
      btn.textContent = label;
      btn.setAttribute("aria-label", label);
      btn.addEventListener("click", () => onPick(value));
      seg.appendChild(btn);
    }
    rowEl.appendChild(seg);
    section.appendChild(rowEl);
  };

  row("Window controls", "Window button set", BUTTON_CHOICES, (value) => {
    if (value === "close" || value === "window") onButtons(value);
  });
  row("Position", "Window button position", SIDE_CHOICES, (value) => {
    if (value === "start" || value === "end") onSide(value);
  });
  return section;
}

/** Mirror of syncThemeSwitcher for the picker's two segmented rows. */
function syncWindowButtonsPicker(section: HTMLElement, preference: WindowButtonsPreference): void {
  section.querySelectorAll<HTMLElement>(".protota-window-buttons-option").forEach((btn) => {
    const row = btn.closest<HTMLElement>(".protota-window-buttons-row");
    const key = row?.querySelector<HTMLElement>(".protota-window-buttons-segment")?.getAttribute("aria-label");
    const on = key === "Window button set"
      ? btn.dataset.value === preference.buttons
      : btn.dataset.value === preference.side;
    btn.classList.toggle("selected", on);
    btn.setAttribute("aria-pressed", String(on));
  });
}

function menuDivider(): HTMLElement {
  const sep = document.createElement("div");
  sep.className = "protota-menu-divider";
  return sep;
}

/**
 * The header app-menu button: a flat header button (the open-menu icon) that
 * toggles a Protota-owned `<gtk-popover>` — the app-menu idiom of theme
 * switcher + window-buttons picker + Icon Library + Show Shortcuts.
 *
 * The children are built imperatively. `PopoverMenuView.render()` calls
 * `replaceChildren()` on the popover owned by `gtk-menu-button`, so injected
 * content is wiped on every render, and the theme switcher + window-buttons
 * picker are custom DOM the menu model cannot express. Rows carry the compiled
 * skin's `.adw-popover-item` contract; the popover keeps the element's Escape /
 * outside-click dismissal, and item activation is the row's own click listener.
 */
export const AppMenuButton: React.FC = () => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<GtkPopoverElement>(null);
  const { appMenuItems, handleToggleDiagnostics } = useMenus();
  const colorScheme = useMockupStore((s) => s.doc.colorScheme);
  const setColorScheme = useMockupStore((s) => s.setColorScheme);
  const windowButtons = useMockupStore((s) => s.windowButtons);
  const setWindowButtons = useMockupStore((s) => s.setWindowButtons);
  const showFlows = useMockupStore((s) => s.showFlows);
  const toggleShowFlows = useMockupStore((s) => s.toggleShowFlows);
  const diagnosticsEnabled = useMockupStore((s) => s.diagnosticsEnabled);
  const isMobile = useIsMobile();

  // On mobile the Flows/Diagnostics toggles leave the cramped header bar and
  // surface as app-menu entries right after the theme picker, labelled by the
  // state they'd switch to (Enable/Disable), with their shortcuts. On desktop
  // the header keeps its icon toggles, so the menu stays as-is. Icon Library
  // and Show Shortcuts are always the last entries.
  const mobileToggleItems: MenuItem[] = isMobile
    ? [
        {
          label: showFlows ? "Disable Screen Flows" : "Enable Screen Flows",
          action: toggleShowFlows,
          shortcut: "Ctrl+;",
        },
        {
          label: diagnosticsEnabled ? "Disable Diagnostics" : "Enable Diagnostics",
          action: handleToggleDiagnostics,
          shortcut: "Ctrl+'",
        },
      ]
    : [];

  const items: MenuItem[] = [...mobileToggleItems, ...appMenuItems];
  // Rebuild the surface only when the entry list actually changes; the actions
  // and shortcuts travel with the rows.
  const itemsKey = JSON.stringify(items.map((item) => [item.label, item.shortcut ?? ""]));

  // Anchor the popover to the trigger, so the surface positions against the
  // button and hands focus back to it on Escape.
  useEffect(() => {
    const pop = popoverRef.current;
    const trigger = triggerRef.current;
    if (pop && trigger) pop.anchor = trigger;
  }, []);

  // Build the surface's children: the theme switcher and window-buttons picker
  // (custom DOM the menu model cannot carry), then the app-menu rows.
  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;

    const switcher = buildThemeSwitcher((choice) => setColorScheme(choice));
    syncThemeSwitcher(switcher, colorScheme);
    pop.appendChild(switcher);
    pop.appendChild(menuDivider());

    // Window-buttons picker (#163).
    const picker = buildWindowButtonsPicker(
      (buttons) => setWindowButtons({ buttons }),
      (side) => setWindowButtons({ side }),
    );
    syncWindowButtonsPicker(picker, windowButtons);
    pop.appendChild(picker);
    pop.appendChild(menuDivider());

    // The app-menu rows, carrying the compiled skin's `.adw-popover-item`
    // contract so `<gtk-popover>` navigates them and the stylesheet styles them.
    for (const item of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "adw-popover-item adw-menu-button-item";
      row.setAttribute("role", "menuitem");
      row.tabIndex = -1;
      const label = document.createElement("span");
      label.className = "adw-menu-button-item-label";
      label.textContent = item.label;
      row.appendChild(label);
      if (item.shortcut) {
        const accel = document.createElement("span");
        accel.className = "adw-popover-item-accel";
        accel.textContent = item.shortcut;
        row.appendChild(accel);
      }
      if (item.action) {
        row.addEventListener("click", () => {
          item.action?.();
          pop.open = false;
        });
      }
      pop.appendChild(row);
    }

    return () => { pop.replaceChildren(); };
  }, [itemsKey, colorScheme, windowButtons, setColorScheme, setWindowButtons]);

  const toggle = () => {
    const pop = popoverRef.current;
    if (pop) pop.open = !pop.open;
  };

  return (
    <div
      data-testid="mobile-menu-button"
      className="protota-app-menu-button"
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="adw-button flat protota-header-icon-button"
        aria-label="Main Menu"
        aria-haspopup="menu"
        title="Menu"
        onClick={toggle}
      >
        <span className="adw-toolbar-icon" style={iconStyle(openMenuSymbolic)} />
      </button>
      <gtk-popover
        ref={popoverRef}
        data-testid="mobile-menu"
        role="menu"
        menu=""
        align="end"
      />
    </div>
  );
};
