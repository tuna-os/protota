import React, { useEffect, useRef } from "react";
import { objectSelectSymbolic } from "@gjsify/adwaita-icons/actions";
import { toDataUri } from "@gjsify/adwaita-icons/utils";
import type { AdwMenuItem } from "@gjsify/adwaita-web";
import { useMockupStore } from "../store/mockupStore";
import { useMenus, type MenuGroup } from "./MenuData";

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
  const { appMenuItems } = useMenus();
  const colorScheme = useMockupStore((s) => s.doc.colorScheme);
  const setColorScheme = useMockupStore((s) => s.setColorScheme);

  // The menu contents are the same on every viewport: one headerless group
  // with the app-menu entries.
  const groups: MenuGroup[] = [{ label: "", items: appMenuItems }];

  // Flatten the groups into the element's flat item model, recording where
  // the separators and the extra group headers belong, and map every item's
  // id back to its action.
  const flatKey = JSON.stringify(
    groups.map((group) => [group.label, group.items.map((i) => (i.divider ? "|" : i.label))]),
  );
  const flatItems: AdwMenuItem[] = [];
  const dividerAfter: number[] = [];
  const groupStarts: number[] = [];
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
      }
    }
  }
  actionsRef.current = actions;

  // The element's flat model cannot carry callbacks — activation comes back
  // as a bubbling menu-item-activated CustomEvent with {id,label,index}.
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

    // Extra group headers (groups 1..n) — divider + menu-title-styled header
    // before each group's first item, the same class the native menu-title
    // attribute renders. Empty labels (the flat app-menu entries on mobile)
    // get no header.
    const itemNodes = Array.from(pop.querySelectorAll(".adw-menu-button-item"));
    for (let g = 1; g < groups.length; g++) {
      if (!groups[g].label) continue;
      const first = itemNodes[groupStarts[g]];
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

    // Stable test target (the element does not forward attributes into its
    // popover, so this is part of the post-render insertion).
    pop.setAttribute("data-testid", "mobile-menu");
  }, [flatKey, colorScheme, setColorScheme]);

  return <adw-menu-button ref={btnRef} data-testid="mobile-menu-button" />;
};
