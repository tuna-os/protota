import type { HTMLAttributes, RefAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "adw-toolbar-view": HTMLAttributes<HTMLElement> & {
        slot?: string;
      };
      "adw-header-bar": HTMLAttributes<HTMLElement> & {
        slot?: string;
        title?: string;
      };
      "adw-window": HTMLAttributes<HTMLElement>;
      "adw-dialog": HTMLAttributes<HTMLElement>;
      "adw-preferences-dialog": HTMLAttributes<HTMLElement>;
      "adw-alert-dialog": HTMLAttributes<HTMLElement>;
      "adw-about-dialog": HTMLAttributes<HTMLElement>;
      "adw-window-title": HTMLAttributes<HTMLElement>;
      "adw-view-stack": HTMLAttributes<HTMLElement>;
      "adw-view-switcher": HTMLAttributes<HTMLElement>;
      "adw-navigation-view": HTMLAttributes<HTMLElement>;
      "adw-tab-view": HTMLAttributes<HTMLElement>;
      "adw-overlay-split-view": HTMLAttributes<HTMLElement>;
      "adw-clamp": HTMLAttributes<HTMLElement>;
      "adw-action-row": HTMLAttributes<HTMLElement>;
      "adw-switch-row": HTMLAttributes<HTMLElement>;
      "adw-combo-row": HTMLAttributes<HTMLElement>;
      "adw-spin-row": HTMLAttributes<HTMLElement>;
      "adw-button-row": HTMLAttributes<HTMLElement>;
      "adw-expander-row": HTMLAttributes<HTMLElement>;
      "adw-entry-row": HTMLAttributes<HTMLElement>;
      "adw-password-entry-row": HTMLAttributes<HTMLElement>;
      "adw-preferences-group": HTMLAttributes<HTMLElement>;
      "adw-preferences-page": HTMLAttributes<HTMLElement>;
      "adw-status-page": HTMLAttributes<HTMLElement>;
      "adw-toast-overlay": HTMLAttributes<HTMLElement>;
      "adw-banner": HTMLAttributes<HTMLElement>;
      "adw-toggle-group": HTMLAttributes<HTMLElement>;
      "adw-split-button": HTMLAttributes<HTMLElement>;
      "adw-menu-button": HTMLAttributes<HTMLElement>;
      "adw-spinner": HTMLAttributes<HTMLElement>;
      "adw-icon": HTMLAttributes<HTMLElement>;
      "adw-toggle": HTMLAttributes<HTMLElement>;
      "adw-button": HTMLAttributes<HTMLElement>;
      "adw-entry": HTMLAttributes<HTMLElement>;
      "adw-wrap-box": HTMLAttributes<HTMLElement>;
      "adw-drop-down": HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement> & {
        options?: { value: string; label: string }[];
        selected?: number;
        "enable-search"?: boolean;
      };
    }
  }
}

export {};
