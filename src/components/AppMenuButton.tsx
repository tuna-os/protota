import React, { useEffect, useLayoutEffect, useRef } from "react";
import { objectSelectSymbolic } from "@gjsify/adwaita-icons/actions";
import { toDataUri } from "@gjsify/adwaita-icons/utils";
import { useMockupStore } from "../store/mockupStore";
import type { AdwMenuItem, AdwMenuNode } from "@gjsify/adwaita-web";
import type { WindowButtonsPreference } from "../utils/headerBarChrome";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMenus } from "./MenuData";

/** The `<gtk-menu-button>` surface, typed for the portable menu model. */
type GtkMenuButtonElement = HTMLElement & {
  menuModel: AdwMenuNode[];
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
 * The window-control preference (#163) as text menu entries: which controls
 * the primary header bar draws, and which side they sit on. Each entry is
 * labelled by the state it switches to — "Reduce Window Controls" while the
 * full set is drawn, "Show Full Window Controls" while only close is; "Apply
 * Left Window Controls" while they sit at the end, "Apply Right" at the start
 * — the same idiom as the mobile Flows/Diagnostics entries.
 */
function windowControlItems(preference: WindowButtonsPreference): AdwMenuItem[] {
  return [
    {
      kind: "item",
      id: "window-buttons",
      label: preference.buttons === "window" ? "Reduce Window Controls" : "Show Full Window Controls",
    },
    {
      kind: "item",
      id: "window-side",
      label: preference.side === "end" ? "Apply Left Window Controls" : "Apply Right Window Controls",
    },
  ];
}

/**
 * Put the theme switcher at the top of the `<gtk-menu-button>`'s popover,
 * above the model-drawn rows. The switcher is the one piece of the surface
 * the portable menu model cannot express, so it is injected after each
 * `render()` (which `replaceChildren()`es the popover) rather than carried as
 * a row. The divider is the skin's own separator so it matches the section
 * boundaries the view draws.
 */
function injectThemeSwitcher(
  menuButton: HTMLElement,
  colorScheme: ThemeChoice,
  onChoose: (choice: ThemeChoice) => void,
): void {
  const popover = menuButton.querySelector<HTMLElement>("gtk-popover");
  if (!popover) return;
  popover.setAttribute("data-testid", "mobile-menu");
  const switcher = buildThemeSwitcher(onChoose);
  syncThemeSwitcher(switcher, colorScheme);
  const divider = document.createElement("div");
  divider.className = "adw-popover-separator";
  divider.setAttribute("role", "separator");
  popover.prepend(divider);
  popover.prepend(switcher);
}

/**
 * The header app-menu button: a `<gtk-menu-button>` whose portable menu model
 * carries the window-control entries (#163), the mobile Flows/Diagnostics
 * toggles, and Icon Library + Keyboard Shortcuts. The model is the same one
 * the Open/Export menus use, so the rows, separators and accelerators are the
 * skin's `modelbutton`s, not bespoke DOM.
 *
 * The theme switcher is the one entry the menu model cannot express, so it is
 * injected into the popover after each render (see injectThemeSwitcher).
 * Activation comes back as the bubbling `menu-item-activated` event, whose id
 * addresses the action map — the model itself carries no callbacks.
 */
export const AppMenuButton: React.FC = () => {
  const menuButtonRef = useRef<GtkMenuButtonElement>(null);
  const { appMenuItems, handleToggleDiagnostics } = useMenus();
  const colorScheme = useMockupStore((s) => s.doc.colorScheme);
  const setColorScheme = useMockupStore((s) => s.setColorScheme);
  const windowButtons = useMockupStore((s) => s.windowButtons);
  const setWindowButtons = useMockupStore((s) => s.setWindowButtons);
  const showFlows = useMockupStore((s) => s.showFlows);
  const toggleShowFlows = useMockupStore((s) => s.toggleShowFlows);
  const diagnosticsEnabled = useMockupStore((s) => s.diagnosticsEnabled);
  const isMobile = useIsMobile();

  /** Latest id→action map, read by the once-registered activation listener. */
  const actionsRef = useRef<Record<string, () => void>>({});
  /** The model text last rendered, so a re-render only rebuilds when it changed. */
  const modelKeyRef = useRef<string | null>(null);

  // Activation arrives as a bubbling menu-item-activated CustomEvent with
  // {id,label,path} — the model cannot carry callbacks.
  useEffect(() => {
    const el = menuButtonRef.current;
    if (!el) return;
    const onActivate = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (typeof id === "string") actionsRef.current[id]?.();
    };
    el.addEventListener("menu-item-activated", onActivate);
    return () => el.removeEventListener("menu-item-activated", onActivate);
  }, []);

  // A layout effect, not a passive one: a `<gtk-menu-button>` with an empty
  // model refuses to open, so the model must be set before the first paint or
  // a click on the freshly-rendered button is silently a no-op.
  useLayoutEffect(() => {
    const el = menuButtonRef.current;
    if (!el) return;

    const actions: Record<string, () => void> = {};
    actions["window-buttons"] = () =>
      setWindowButtons({ buttons: windowButtons.buttons === "window" ? "close" : "window" });
    actions["window-side"] = () =>
      setWindowButtons({ side: windowButtons.side === "end" ? "start" : "end" });

    // On mobile the Flows/Diagnostics toggles leave the cramped header bar and
    // surface as menu entries labelled by the state they'd switch to, with
    // their shortcuts. On desktop the header keeps its icon toggles, so the
    // section is empty. Icon Library and Show Shortcuts are always last.
    const menuItems: AdwMenuItem[] = [];
    if (isMobile) {
      menuItems.push(
        {
          kind: "item",
          id: "toggle-flows",
          label: showFlows ? "Disable Screen Flows" : "Enable Screen Flows",
          accel: "Ctrl+;",
        },
        {
          kind: "item",
          id: "toggle-diagnostics",
          label: diagnosticsEnabled ? "Disable Diagnostics" : "Enable Diagnostics",
          accel: "Ctrl+'",
        },
      );
      actions["toggle-flows"] = toggleShowFlows;
      actions["toggle-diagnostics"] = handleToggleDiagnostics;
    }
    for (const item of appMenuItems) {
      menuItems.push({
        kind: "item",
        id: item.label,
        label: item.label,
        ...(item.shortcut ? { accel: item.shortcut } : {}),
      });
      if (item.action) actions[item.label] = item.action;
    }

    // Two sections: the window-control entries, then the rest. The view draws
    // the boundary between them as the skin's separator.
    const model: AdwMenuNode[] = [
      { kind: "section", items: windowControlItems(windowButtons) },
      { kind: "section", items: menuItems },
    ];
    const modelKey = JSON.stringify(model);

    const btn = el.querySelector<HTMLButtonElement>(".adw-menu-button-button");
    if (btn) {
      btn.setAttribute("title", "Menu");
      btn.setAttribute("aria-label", "Main Menu");
    }

    if (modelKey !== modelKeyRef.current) {
      modelKeyRef.current = modelKey;
      actionsRef.current = actions;
      // Setting menuModel rebuilds the popover, so the switcher must follow it.
      el.menuModel = model;
      injectThemeSwitcher(el, colorScheme, setColorScheme);
    } else {
      // The rows are unchanged (a theme pick only), so just move the selection.
      const switcher = el.querySelector<HTMLElement>(".protota-theme-switcher");
      if (switcher) syncThemeSwitcher(switcher, colorScheme);
    }
  }, [
    appMenuItems,
    colorScheme,
    windowButtons,
    isMobile,
    showFlows,
    toggleShowFlows,
    diagnosticsEnabled,
    handleToggleDiagnostics,
    setColorScheme,
    setWindowButtons,
  ]);

  return <gtk-menu-button ref={menuButtonRef} data-testid="mobile-menu-button" />;
};
