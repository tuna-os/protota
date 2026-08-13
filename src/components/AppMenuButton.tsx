import React, { useEffect, useRef } from "react";
import { objectSelectSymbolic } from "@gjsify/adwaita-icons/actions";
import { toDataUri } from "@gjsify/adwaita-icons/utils";
import type { AdwMenuItem } from "@gjsify/adwaita-web";
import { useMockupStore } from "../store/mockupStore";
import type { WindowButtonsPreference } from "../utils/headerBarChrome";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMenus, type MenuGroup, type MenuItem } from "./MenuData";

type AdwMenuButtonElement = HTMLElement & {
  menuItems: AdwMenuItem[];
  menuTitle: string;
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
 * Each swatch is a 48px painted circle; the selected one gets a 3px accent
 * ring ON the circle's own rim (an inset shadow on the circle — a ring on
 * the button itself is painted over by the circle) plus a 20px accent badge
 * at the bottom-right carrying a white objectSelectSymbolic check.
 * Interaction-verified reference: postplan draft section 6
 * (/tmp/adw-menu-demo/build-demo.mjs).
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

/** Drive the selected state three ways (class, aria-pressed, inline styles)
 * so no CSS selector or stacking issue can defeat it — same belt-and-braces
 * as the verified demo. */
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
 * buttons (Full / Close only) and where they sit (End / Start). Rendered
 * post-render like the theme switcher; options carry aria-pressed and a
 * `.selected` class so selection survives any CSS stacking.
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

/**
 * The header app-menu button: an <adw-menu-button> (the flat header app-menu
 * button, default open-menu icon) at the header end before the Properties
 * toggle, on every viewport. It holds the app-menu idiom — theme switcher +
 * Icon Library + Show Shortcuts — and the same entries on mobile as on
 * desktop (the mobile-only "Actions" overflow group is gone; New Screen lives
 * in the bottom bar). "Open" and "Export" are labelled header menu buttons on
 * every viewport, so they are not spread into this menu.
 *
 * Menu items go in through the element's own flat {id,label,icon} model; the
 * theme switcher, the extra group headers, and the separators cannot be
 * expressed in that model, so they are inserted into the popover after the
 * element renders (arrow-key nav skips them — only .adw-menu-button-item
 * buttons are roving-tabindex'd). Item activation comes back as the
 * bubbling menu-item-activated event, mapped to the menu data's actions.
 */
export const AppMenuButton: React.FC = () => {
  const btnRef = useRef<AdwMenuButtonElement>(null);
  /** Latest id→action map, read by the (once-registered) activation listener. */
  const actionsRef = useRef<Record<string, () => void>>({});
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
        { label: "divider", divider: true },
      ]
    : [];

  // The menu contents are the same on every viewport: one headerless group
  // with the app-menu entries, plus the mobile-only Flows/Diagnostics toggles
  // ahead of them on mobile.
  const groups: MenuGroup[] = [{ label: "", items: [...mobileToggleItems, ...appMenuItems] }];

  // Flatten the groups into the element's flat item model, recording where
  // the separators and the extra group headers belong, and map every item's
  // id back to its action.
  const flatKey = JSON.stringify(
    groups.map((group) => [group.label, group.items.map((i) => (i.divider ? "|" : i.label))]),
  );
  const flatItems: AdwMenuItem[] = [];
  const dividerAfter: number[] = [];
  const groupStarts: number[] = [];
  const shortcuts: Record<string, string> = {};
  const actions: Record<string, () => void> = {};
  for (const group of groups) {
    groupStarts.push(flatItems.length);
    for (const item of group.items) {
      if (item.divider) {
        if (flatItems.length > 0) dividerAfter.push(flatItems.length - 1);
      } else {
        const id = `${group.label ? `${group.label}:` : ""}${item.label}`;
        flatItems.push({ id, label: item.label });
        if (item.action) actions[id] = item.action;
        if (item.shortcut) shortcuts[id] = item.shortcut;
      }
    }
  }
  actionsRef.current = actions;

  // The element's flat model cannot carry callbacks — activation comes back
  // as a bubbling menu-item-activated CustomEvent with {id,label,index}.
  // Listener is attached directly to the element (same pattern as the
  // labelled Open/Export menus in Header.tsx) so it stays scoped to this
  // button and does not depend on DOM traversal that can race against
  // popover teardown when an item is clicked.
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

    // Drive the element's own model (the property API — same path the demo's
    // "Programmatic API" section uses; the menu attribute would need JSON
    // escaping). The app-menu has no popover title on either viewport.
    el.menuItems = flatItems;
    // The element derives the trigger's aria-label from menu-title; a global
    // app menu keeps the hamburger's established accessible name instead.
    const trigger = el.querySelector("button");
    if (trigger) {
      trigger.setAttribute("aria-label", "Main Menu");
      // Tooltip, matching the other header icon buttons (HeaderIconButton).
      trigger.setAttribute("title", "Menu");
    }

    const pop = el.querySelector(".adw-menu-button-popover");
    if (!pop) return;

    // Theme switcher — the first entry of the popover.
    let switcher = pop.querySelector<HTMLElement>(":scope > .protota-theme-switcher");
    if (!switcher) {
      switcher = buildThemeSwitcher((choice) => setColorScheme(choice));
      pop.insertBefore(switcher, pop.firstChild);
      const sep = document.createElement("div");
      sep.className = "protota-menu-divider";
      pop.insertBefore(sep, switcher.nextSibling);
    }
    syncThemeSwitcher(switcher, colorScheme);

    // Window-buttons picker (#163) — right after the theme switcher's
    // divider, before the app-menu entries. A personal preference like the
    // theme, so it lives with the theme picker until a Preferences window
    // exists (issue #163).
    let buttonsPicker = pop.querySelector<HTMLElement>(":scope > .protota-window-buttons-picker");
    if (!buttonsPicker) {
      buttonsPicker = buildWindowButtonsPicker(
        (buttons) => setWindowButtons({ buttons }),
        (side) => setWindowButtons({ side }),
      );
      const firstItem = pop.querySelector<HTMLElement>(".adw-menu-button-item");
      if (firstItem) pop.insertBefore(buttonsPicker, firstItem);
      else pop.appendChild(buttonsPicker);
      const sep = document.createElement("div");
      sep.className = "protota-menu-divider";
      pop.insertBefore(sep, buttonsPicker.nextSibling);
    }
    syncWindowButtonsPicker(buttonsPicker, windowButtons);

    // Extra group headers (groups 1..n) — divider + menu-title-styled header
    // before each group's first item, the same class the native menu-title
    // attribute renders. Empty labels (the flat app-menu entries on mobile)
    // get no header.
    const headerItemNodes = Array.from(pop.querySelectorAll(".adw-menu-button-item"));
    for (let g = 1; g < groups.length; g++) {
      if (!groups[g].label) continue;
      const first = headerItemNodes[groupStarts[g]];
      if (!first) continue;
      const sep = document.createElement("div");
      sep.className = "protota-menu-divider";
      const header = document.createElement("div");
      header.className = "adw-menu-button-title";
      header.textContent = groups[g].label;
      pop.insertBefore(sep, first);
      pop.insertBefore(header, first);
    }

    // Intra-group separators at their recorded flat indices.
    const nodes = Array.from(pop.querySelectorAll(".adw-menu-button-item"));
    for (const idx of dividerAfter) {
      const sep = document.createElement("div");
      sep.className = "protota-menu-divider";
      nodes[idx]?.after(sep);
    }

    // Right-aligned shortcut column (Show Shortcuts, and the mobile-only
    // Flows/Diagnostics toggles), the same idiom as the labelled menus.
    nodes.forEach((node, i) => {
      const shortcut = shortcuts[flatItems[i]?.id ?? ""];
      if (shortcut) {
        const sc = document.createElement("span");
        sc.className = "adw-menu-button-item-shortcut";
        sc.textContent = shortcut;
        node.appendChild(sc);
      }
    });

    // Stable test target (the element does not forward attributes into its
    // popover, so this is part of the post-render insertion).
    pop.setAttribute("data-testid", "mobile-menu");
  }, [flatKey, colorScheme, setColorScheme, windowButtons, setWindowButtons]);

  return <adw-menu-button ref={btnRef} data-testid="mobile-menu-button" />;
};
