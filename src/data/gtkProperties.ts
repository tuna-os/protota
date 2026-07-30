/**
 * GTK and libadwaita property tables, generated from GObject introspection
 * data by scripts/extract-gtk-properties.mjs. Regenerate when Protota targets
 * a newer GNOME; do not hand-edit.
 *
 * A TypeScript module rather than JSON so it loads identically under Vite and
 * the test runner, which disagree about JSON import attributes.
 */
export interface GtkClassInfo {
  parent: string | null;
  implements?: string[];
  properties: string[];
}

export const GTK_PROPERTY_DATA: {
  generatedFrom: string[];
  classes: Record<string, GtkClassInfo>;
  interfaces: Record<string, string[]>;
} = {
 "generatedFrom": [
  "Adw-1.gir",
  "GObject-2.0.gir",
  "Gio-2.0.gir",
  "Gtk-4.0.gir"
 ],
 "classes": {
  "Adw.AboutDialog": {
   "parent": "Adw.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "application-icon",
    "application-name",
    "artists",
    "comments",
    "copyright",
    "debug-info",
    "debug-info-filename",
    "designers",
    "developer-name",
    "developers",
    "documenters",
    "issue-url",
    "license",
    "license-type",
    "release-notes",
    "release-notes-version",
    "support-url",
    "translator-credits",
    "version",
    "website"
   ]
  },
  "Adw.AboutWindow": {
   "parent": "Adw.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "application-icon",
    "application-name",
    "artists",
    "comments",
    "copyright",
    "debug-info",
    "debug-info-filename",
    "designers",
    "developer-name",
    "developers",
    "documenters",
    "issue-url",
    "license",
    "license-type",
    "release-notes",
    "release-notes-version",
    "support-url",
    "translator-credits",
    "version",
    "website"
   ]
  },
  "Adw.ActionRow": {
   "parent": "Adw.PreferencesRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "activatable-widget",
    "icon-name",
    "subtitle",
    "subtitle-lines",
    "subtitle-selectable",
    "title-lines"
   ]
  },
  "Adw.AlertDialog": {
   "parent": "Adw.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "body",
    "body-use-markup",
    "close-response",
    "default-response",
    "extra-child",
    "heading",
    "heading-use-markup",
    "prefer-wide-layout"
   ]
  },
  "Adw.Animation": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "follow-enable-animations-setting",
    "state",
    "target",
    "value",
    "widget"
   ]
  },
  "Adw.AnimationTarget": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Adw.Application": {
   "parent": "Gtk.Application",
   "implements": [
    "Gio.ActionGroup",
    "Gio.ActionMap"
   ],
   "properties": [
    "style-manager"
   ]
  },
  "Adw.ApplicationWindow": {
   "parent": "Gtk.ApplicationWindow",
   "implements": [
    "Gio.ActionGroup",
    "Gio.ActionMap",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "adaptive-preview",
    "content",
    "current-breakpoint",
    "dialogs",
    "visible-dialog"
   ]
  },
  "Adw.Avatar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "custom-image",
    "icon-name",
    "show-initials",
    "size",
    "text"
   ]
  },
  "Adw.Banner": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "button-label",
    "button-style",
    "revealed",
    "title",
    "use-markup"
   ]
  },
  "Adw.Bin": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child"
   ]
  },
  "Adw.BottomSheet": {
   "parent": "Gtk.Widget",
   "implements": [
    "Adw.Swipeable",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "align",
    "bottom-bar",
    "bottom-bar-height",
    "can-close",
    "can-open",
    "content",
    "full-width",
    "modal",
    "open",
    "reveal-bottom-bar",
    "sheet",
    "sheet-height",
    "show-drag-handle"
   ]
  },
  "Adw.Breakpoint": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Buildable"
   ],
   "properties": [
    "condition"
   ]
  },
  "Adw.BreakpointBin": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "current-breakpoint"
   ]
  },
  "Adw.ButtonContent": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "can-shrink",
    "icon-name",
    "label",
    "use-underline"
   ]
  },
  "Adw.ButtonRow": {
   "parent": "Adw.PreferencesRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "end-icon-name",
    "start-icon-name"
   ]
  },
  "Adw.CallbackAnimationTarget": {
   "parent": "Adw.AnimationTarget",
   "implements": [],
   "properties": []
  },
  "Adw.Carousel": {
   "parent": "Gtk.Widget",
   "implements": [
    "Adw.Swipeable",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "allow-long-swipes",
    "allow-mouse-drag",
    "allow-scroll-wheel",
    "interactive",
    "n-pages",
    "position",
    "reveal-duration",
    "scroll-params",
    "spacing"
   ]
  },
  "Adw.CarouselIndicatorDots": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "carousel"
   ]
  },
  "Adw.CarouselIndicatorLines": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "carousel"
   ]
  },
  "Adw.Clamp": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "child",
    "maximum-size",
    "tightening-threshold",
    "unit"
   ]
  },
  "Adw.ClampLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [
    "Gtk.Orientable"
   ],
   "properties": [
    "maximum-size",
    "tightening-threshold",
    "unit"
   ]
  },
  "Adw.ClampScrollable": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable",
    "Gtk.Scrollable"
   ],
   "properties": [
    "child",
    "maximum-size",
    "tightening-threshold",
    "unit"
   ]
  },
  "Adw.ComboRow": {
   "parent": "Adw.ActionRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "enable-search",
    "expression",
    "factory",
    "header-factory",
    "list-factory",
    "model",
    "search-match-mode",
    "selected",
    "selected-item",
    "use-subtitle"
   ]
  },
  "Adw.Dialog": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "can-close",
    "child",
    "content-height",
    "content-width",
    "current-breakpoint",
    "default-widget",
    "focus-widget",
    "follows-content-size",
    "presentation-mode",
    "title"
   ]
  },
  "Adw.EntryRow": {
   "parent": "Adw.PreferencesRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": [
    "activates-default",
    "attributes",
    "enable-emoji-completion",
    "input-hints",
    "input-purpose",
    "max-length",
    "show-apply-button",
    "text-length"
   ]
  },
  "Adw.EnumListItem": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "name",
    "nick",
    "value"
   ]
  },
  "Adw.EnumListModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel"
   ],
   "properties": [
    "enum-type"
   ]
  },
  "Adw.ExpanderRow": {
   "parent": "Adw.PreferencesRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "enable-expansion",
    "expanded",
    "icon-name",
    "show-enable-switch",
    "subtitle",
    "subtitle-lines",
    "title-lines"
   ]
  },
  "Adw.Flap": {
   "parent": "Gtk.Widget",
   "implements": [
    "Adw.Swipeable",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "content",
    "flap",
    "flap-position",
    "fold-duration",
    "fold-policy",
    "fold-threshold-policy",
    "folded",
    "locked",
    "modal",
    "reveal-flap",
    "reveal-params",
    "reveal-progress",
    "separator",
    "swipe-to-close",
    "swipe-to-open",
    "transition-type"
   ]
  },
  "Adw.HeaderBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "centering-policy",
    "decoration-layout",
    "show-back-button",
    "show-end-title-buttons",
    "show-start-title-buttons",
    "show-title",
    "title-widget"
   ]
  },
  "Adw.InlineViewSwitcher": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "can-shrink",
    "display-mode",
    "homogeneous",
    "stack"
   ]
  },
  "Adw.Layout": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Buildable"
   ],
   "properties": [
    "content",
    "name"
   ]
  },
  "Adw.LayoutSlot": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "id"
   ]
  },
  "Adw.Leaflet": {
   "parent": "Gtk.Widget",
   "implements": [
    "Adw.Swipeable",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "can-navigate-back",
    "can-navigate-forward",
    "can-unfold",
    "child-transition-params",
    "child-transition-running",
    "fold-threshold-policy",
    "folded",
    "homogeneous",
    "mode-transition-duration",
    "pages",
    "transition-type",
    "visible-child",
    "visible-child-name"
   ]
  },
  "Adw.LeafletPage": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "child",
    "name",
    "navigatable"
   ]
  },
  "Adw.MessageDialog": {
   "parent": "Gtk.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "body",
    "body-use-markup",
    "close-response",
    "default-response",
    "extra-child",
    "heading",
    "heading-use-markup"
   ]
  },
  "Adw.MultiLayoutView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "layout",
    "layout-name"
   ]
  },
  "Adw.NavigationPage": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "can-pop",
    "child",
    "tag",
    "title"
   ]
  },
  "Adw.NavigationSplitView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "collapsed",
    "content",
    "max-sidebar-width",
    "min-sidebar-width",
    "show-content",
    "sidebar",
    "sidebar-position",
    "sidebar-width-fraction",
    "sidebar-width-unit"
   ]
  },
  "Adw.NavigationView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Adw.Swipeable",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "animate-transitions",
    "hhomogeneous",
    "navigation-stack",
    "pop-on-escape",
    "vhomogeneous",
    "visible-page",
    "visible-page-tag"
   ]
  },
  "Adw.OverlaySplitView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Adw.Swipeable",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "collapsed",
    "content",
    "enable-hide-gesture",
    "enable-show-gesture",
    "max-sidebar-width",
    "min-sidebar-width",
    "pin-sidebar",
    "show-sidebar",
    "sidebar",
    "sidebar-position",
    "sidebar-width-fraction",
    "sidebar-width-unit"
   ]
  },
  "Adw.PasswordEntryRow": {
   "parent": "Adw.EntryRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": []
  },
  "Adw.PreferencesDialog": {
   "parent": "Adw.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "search-enabled",
    "visible-page",
    "visible-page-name"
   ]
  },
  "Adw.PreferencesGroup": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "description",
    "header-suffix",
    "separate-rows",
    "title"
   ]
  },
  "Adw.PreferencesPage": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "banner",
    "description",
    "description-centered",
    "icon-name",
    "name",
    "title",
    "use-underline"
   ]
  },
  "Adw.PreferencesRow": {
   "parent": "Gtk.ListBoxRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "title",
    "title-selectable",
    "use-markup",
    "use-underline"
   ]
  },
  "Adw.PreferencesWindow": {
   "parent": "Adw.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "can-navigate-back",
    "search-enabled",
    "visible-page",
    "visible-page-name"
   ]
  },
  "Adw.PropertyAnimationTarget": {
   "parent": "Adw.AnimationTarget",
   "implements": [],
   "properties": [
    "object",
    "pspec"
   ]
  },
  "Adw.ShortcutLabel": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "accelerator",
    "disabled-text"
   ]
  },
  "Adw.ShortcutsDialog": {
   "parent": "Adw.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.ShortcutManager"
   ],
   "properties": []
  },
  "Adw.ShortcutsItem": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accelerator",
    "action-name",
    "direction",
    "subtitle",
    "title"
   ]
  },
  "Adw.ShortcutsSection": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.Buildable"
   ],
   "properties": [
    "title"
   ]
  },
  "Adw.SpinRow": {
   "parent": "Adw.ActionRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": [
    "adjustment",
    "climb-rate",
    "digits",
    "numeric",
    "snap-to-ticks",
    "update-policy",
    "value",
    "wrap"
   ]
  },
  "Adw.Spinner": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": []
  },
  "Adw.SpinnerPaintable": {
   "parent": "GObject.Object",
   "implements": [
    "Gdk.Paintable",
    "Gtk.SymbolicPaintable"
   ],
   "properties": [
    "widget"
   ]
  },
  "Adw.SplitButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "can-shrink",
    "child",
    "direction",
    "dropdown-tooltip",
    "icon-name",
    "label",
    "menu-model",
    "popover",
    "use-underline"
   ]
  },
  "Adw.SpringAnimation": {
   "parent": "Adw.Animation",
   "implements": [],
   "properties": [
    "clamp",
    "epsilon",
    "estimated-duration",
    "initial-velocity",
    "spring-params",
    "value-from",
    "value-to",
    "velocity"
   ]
  },
  "Adw.Squeezer": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "allow-none",
    "homogeneous",
    "interpolate-size",
    "pages",
    "switch-threshold-policy",
    "transition-duration",
    "transition-running",
    "transition-type",
    "visible-child",
    "xalign",
    "yalign"
   ]
  },
  "Adw.SqueezerPage": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "child",
    "enabled"
   ]
  },
  "Adw.StatusPage": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "description",
    "icon-name",
    "paintable",
    "title"
   ]
  },
  "Adw.StyleManager": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accent-color",
    "accent-color-rgba",
    "color-scheme",
    "dark",
    "display",
    "document-font-name",
    "high-contrast",
    "monospace-font-name",
    "system-supports-accent-colors",
    "system-supports-color-schemes"
   ]
  },
  "Adw.SwipeTracker": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Orientable"
   ],
   "properties": [
    "allow-long-swipes",
    "allow-mouse-drag",
    "allow-window-handle",
    "enabled",
    "lower-overshoot",
    "reversed",
    "swipeable",
    "upper-overshoot"
   ]
  },
  "Adw.SwitchRow": {
   "parent": "Adw.ActionRow",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "active"
   ]
  },
  "Adw.TabBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "autohide",
    "end-action-widget",
    "expand-tabs",
    "extra-drag-preferred-action",
    "extra-drag-preload",
    "inverted",
    "is-overflowing",
    "start-action-widget",
    "tabs-revealed",
    "view"
   ]
  },
  "Adw.TabButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "view"
   ]
  },
  "Adw.TabOverview": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "enable-new-tab",
    "enable-search",
    "extra-drag-preferred-action",
    "extra-drag-preload",
    "inverted",
    "open",
    "search-active",
    "secondary-menu",
    "show-end-title-buttons",
    "show-start-title-buttons",
    "view"
   ]
  },
  "Adw.TabPage": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Accessible"
   ],
   "properties": [
    "child",
    "icon",
    "indicator-activatable",
    "indicator-icon",
    "indicator-tooltip",
    "keyword",
    "live-thumbnail",
    "loading",
    "needs-attention",
    "parent",
    "pinned",
    "selected",
    "thumbnail-xalign",
    "thumbnail-yalign",
    "title",
    "tooltip"
   ]
  },
  "Adw.TabView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "default-icon",
    "is-transferring-page",
    "menu-model",
    "n-pages",
    "n-pinned-pages",
    "pages",
    "selected-page",
    "shortcuts"
   ]
  },
  "Adw.TimedAnimation": {
   "parent": "Adw.Animation",
   "implements": [],
   "properties": [
    "alternate",
    "duration",
    "easing",
    "repeat-count",
    "reverse",
    "value-from",
    "value-to"
   ]
  },
  "Adw.Toast": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "action-name",
    "action-target",
    "button-label",
    "custom-title",
    "priority",
    "timeout",
    "title",
    "use-markup"
   ]
  },
  "Adw.ToastOverlay": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child"
   ]
  },
  "Adw.Toggle": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "child",
    "enabled",
    "icon-name",
    "label",
    "name",
    "tooltip",
    "use-underline"
   ]
  },
  "Adw.ToggleGroup": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "active",
    "active-name",
    "can-shrink",
    "homogeneous",
    "n-toggles",
    "toggles"
   ]
  },
  "Adw.ToolbarView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "bottom-bar-height",
    "bottom-bar-style",
    "content",
    "extend-content-to-bottom-edge",
    "extend-content-to-top-edge",
    "reveal-bottom-bars",
    "reveal-top-bars",
    "top-bar-height",
    "top-bar-style"
   ]
  },
  "Adw.ViewStack": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "enable-transitions",
    "hhomogeneous",
    "pages",
    "transition-duration",
    "transition-running",
    "vhomogeneous",
    "visible-child",
    "visible-child-name"
   ]
  },
  "Adw.ViewStackPage": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Accessible"
   ],
   "properties": [
    "badge-number",
    "child",
    "icon-name",
    "name",
    "needs-attention",
    "title",
    "use-underline",
    "visible"
   ]
  },
  "Adw.ViewStackPages": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SelectionModel"
   ],
   "properties": [
    "selected-page"
   ]
  },
  "Adw.ViewSwitcher": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "policy",
    "stack"
   ]
  },
  "Adw.ViewSwitcherBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "reveal",
    "stack"
   ]
  },
  "Adw.ViewSwitcherTitle": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "stack",
    "subtitle",
    "title",
    "title-visible",
    "view-switcher-enabled"
   ]
  },
  "Adw.Window": {
   "parent": "Gtk.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "adaptive-preview",
    "content",
    "current-breakpoint",
    "dialogs",
    "visible-dialog"
   ]
  },
  "Adw.WindowTitle": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "subtitle",
    "title"
   ]
  },
  "Adw.WrapBox": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "align",
    "child-spacing",
    "child-spacing-unit",
    "justify",
    "justify-last-line",
    "line-homogeneous",
    "line-spacing",
    "line-spacing-unit",
    "natural-line-length",
    "natural-line-length-unit",
    "pack-direction",
    "wrap-policy",
    "wrap-reverse"
   ]
  },
  "Adw.WrapLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [
    "Gtk.Orientable"
   ],
   "properties": [
    "align",
    "child-spacing",
    "child-spacing-unit",
    "justify",
    "justify-last-line",
    "line-homogeneous",
    "line-spacing",
    "line-spacing-unit",
    "natural-line-length",
    "natural-line-length-unit",
    "pack-direction",
    "wrap-policy",
    "wrap-reverse"
   ]
  },
  "GObject.Binding": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "flags",
    "source",
    "source-property",
    "target",
    "target-property"
   ]
  },
  "GObject.BindingGroup": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "source"
   ]
  },
  "GObject.InitiallyUnowned": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "GObject.Object": {
   "parent": null,
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpec": {
   "parent": null,
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecBoolean": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecBoxed": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecChar": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecDouble": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecEnum": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecFlags": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecFloat": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecGType": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecInt": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecInt64": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecLong": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecObject": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecOverride": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecParam": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecPointer": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecString": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecUChar": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecUInt": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecUInt64": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecULong": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecUnichar": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecValueArray": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.ParamSpecVariant": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "GObject.SignalGroup": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "target",
    "target-type"
   ]
  },
  "GObject.TypeModule": {
   "parent": "GObject.Object",
   "implements": [
    "GObject.TypePlugin"
   ],
   "properties": []
  },
  "Gio.AppInfoMonitor": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.AppLaunchContext": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.Application": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ActionGroup",
    "Gio.ActionMap"
   ],
   "properties": [
    "action-group",
    "application-id",
    "flags",
    "inactivity-timeout",
    "is-busy",
    "is-registered",
    "is-remote",
    "resource-base-path",
    "version"
   ]
  },
  "Gio.ApplicationCommandLine": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "arguments",
    "is-remote",
    "options",
    "platform-data"
   ]
  },
  "Gio.BufferedInputStream": {
   "parent": "Gio.FilterInputStream",
   "implements": [
    "Gio.Seekable"
   ],
   "properties": [
    "buffer-size"
   ]
  },
  "Gio.BufferedOutputStream": {
   "parent": "Gio.FilterOutputStream",
   "implements": [
    "Gio.Seekable"
   ],
   "properties": [
    "auto-grow",
    "buffer-size"
   ]
  },
  "Gio.BytesIcon": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Icon",
    "Gio.LoadableIcon"
   ],
   "properties": [
    "bytes"
   ]
  },
  "Gio.Cancellable": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.CharsetConverter": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Converter",
    "Gio.Initable"
   ],
   "properties": [
    "from-charset",
    "to-charset",
    "use-fallback"
   ]
  },
  "Gio.ConverterInputStream": {
   "parent": "Gio.FilterInputStream",
   "implements": [
    "Gio.PollableInputStream"
   ],
   "properties": [
    "converter"
   ]
  },
  "Gio.ConverterOutputStream": {
   "parent": "Gio.FilterOutputStream",
   "implements": [
    "Gio.PollableOutputStream"
   ],
   "properties": [
    "converter"
   ]
  },
  "Gio.Credentials": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.DBusActionGroup": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ActionGroup",
    "Gio.RemoteActionGroup"
   ],
   "properties": []
  },
  "Gio.DBusAuthObserver": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.DBusConnection": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.AsyncInitable",
    "Gio.Initable"
   ],
   "properties": [
    "address",
    "authentication-observer",
    "capabilities",
    "closed",
    "exit-on-close",
    "flags",
    "guid",
    "stream",
    "unique-name"
   ]
  },
  "Gio.DBusInterfaceSkeleton": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.DBusInterface"
   ],
   "properties": [
    "g-flags"
   ]
  },
  "Gio.DBusMenuModel": {
   "parent": "Gio.MenuModel",
   "implements": [],
   "properties": []
  },
  "Gio.DBusMessage": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "locked"
   ]
  },
  "Gio.DBusMethodInvocation": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.DBusObjectManagerClient": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.AsyncInitable",
    "Gio.DBusObjectManager",
    "Gio.Initable"
   ],
   "properties": [
    "bus-type",
    "connection",
    "flags",
    "get-proxy-type-destroy-notify",
    "get-proxy-type-func",
    "get-proxy-type-user-data",
    "name",
    "name-owner",
    "object-path"
   ]
  },
  "Gio.DBusObjectManagerServer": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.DBusObjectManager"
   ],
   "properties": [
    "connection",
    "object-path"
   ]
  },
  "Gio.DBusObjectProxy": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.DBusObject"
   ],
   "properties": [
    "g-connection",
    "g-object-path"
   ]
  },
  "Gio.DBusObjectSkeleton": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.DBusObject"
   ],
   "properties": [
    "g-object-path"
   ]
  },
  "Gio.DBusProxy": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.AsyncInitable",
    "Gio.DBusInterface",
    "Gio.Initable"
   ],
   "properties": [
    "g-bus-type",
    "g-connection",
    "g-default-timeout",
    "g-flags",
    "g-interface-info",
    "g-interface-name",
    "g-name",
    "g-name-owner",
    "g-object-path"
   ]
  },
  "Gio.DBusServer": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Initable"
   ],
   "properties": [
    "active",
    "address",
    "authentication-observer",
    "client-address",
    "flags",
    "guid"
   ]
  },
  "Gio.DataInputStream": {
   "parent": "Gio.BufferedInputStream",
   "implements": [
    "Gio.Seekable"
   ],
   "properties": [
    "byte-order",
    "newline-type"
   ]
  },
  "Gio.DataOutputStream": {
   "parent": "Gio.FilterOutputStream",
   "implements": [
    "Gio.Seekable"
   ],
   "properties": [
    "byte-order"
   ]
  },
  "Gio.DebugControllerDBus": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.DebugController",
    "Gio.Initable"
   ],
   "properties": [
    "connection"
   ]
  },
  "Gio.Emblem": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Icon"
   ],
   "properties": [
    "icon",
    "origin"
   ]
  },
  "Gio.EmblemedIcon": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Icon"
   ],
   "properties": [
    "gicon"
   ]
  },
  "Gio.FileEnumerator": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "container"
   ]
  },
  "Gio.FileIOStream": {
   "parent": "Gio.IOStream",
   "implements": [
    "Gio.Seekable"
   ],
   "properties": []
  },
  "Gio.FileIcon": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Icon",
    "Gio.LoadableIcon"
   ],
   "properties": [
    "file"
   ]
  },
  "Gio.FileInfo": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.FileInputStream": {
   "parent": "Gio.InputStream",
   "implements": [
    "Gio.Seekable"
   ],
   "properties": []
  },
  "Gio.FileMonitor": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "cancelled",
    "rate-limit"
   ]
  },
  "Gio.FileOutputStream": {
   "parent": "Gio.OutputStream",
   "implements": [
    "Gio.Seekable"
   ],
   "properties": []
  },
  "Gio.FilenameCompleter": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.FilterInputStream": {
   "parent": "Gio.InputStream",
   "implements": [],
   "properties": [
    "base-stream",
    "close-base-stream"
   ]
  },
  "Gio.FilterOutputStream": {
   "parent": "Gio.OutputStream",
   "implements": [],
   "properties": [
    "base-stream",
    "close-base-stream"
   ]
  },
  "Gio.IOModule": {
   "parent": "GObject.TypeModule",
   "implements": [
    "GObject.TypePlugin"
   ],
   "properties": []
  },
  "Gio.IOStream": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "closed",
    "input-stream",
    "output-stream"
   ]
  },
  "Gio.InetAddress": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "bytes",
    "family",
    "flowinfo",
    "is-any",
    "is-link-local",
    "is-loopback",
    "is-mc-global",
    "is-mc-link-local",
    "is-mc-node-local",
    "is-mc-org-local",
    "is-mc-site-local",
    "is-multicast",
    "is-site-local",
    "scope-id"
   ]
  },
  "Gio.InetAddressMask": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Initable"
   ],
   "properties": [
    "address",
    "family",
    "length"
   ]
  },
  "Gio.InetSocketAddress": {
   "parent": "Gio.SocketAddress",
   "implements": [
    "Gio.SocketConnectable"
   ],
   "properties": [
    "address",
    "flowinfo",
    "port",
    "scope-id"
   ]
  },
  "Gio.InputStream": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.ListStore": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel"
   ],
   "properties": [
    "item-type",
    "n-items"
   ]
  },
  "Gio.MemoryInputStream": {
   "parent": "Gio.InputStream",
   "implements": [
    "Gio.PollableInputStream",
    "Gio.Seekable"
   ],
   "properties": []
  },
  "Gio.MemoryOutputStream": {
   "parent": "Gio.OutputStream",
   "implements": [
    "Gio.PollableOutputStream",
    "Gio.Seekable"
   ],
   "properties": [
    "data",
    "data-size",
    "destroy-function",
    "realloc-function",
    "size"
   ]
  },
  "Gio.Menu": {
   "parent": "Gio.MenuModel",
   "implements": [],
   "properties": []
  },
  "Gio.MenuAttributeIter": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.MenuItem": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.MenuLinkIter": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.MenuModel": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.MountOperation": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "anonymous",
    "choice",
    "domain",
    "is-tcrypt-hidden-volume",
    "is-tcrypt-system-volume",
    "password",
    "password-save",
    "pim",
    "username"
   ]
  },
  "Gio.NativeSocketAddress": {
   "parent": "Gio.SocketAddress",
   "implements": [
    "Gio.SocketConnectable"
   ],
   "properties": []
  },
  "Gio.NativeVolumeMonitor": {
   "parent": "Gio.VolumeMonitor",
   "implements": [],
   "properties": []
  },
  "Gio.NetworkAddress": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.SocketConnectable"
   ],
   "properties": [
    "hostname",
    "port",
    "scheme"
   ]
  },
  "Gio.NetworkService": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.SocketConnectable"
   ],
   "properties": [
    "domain",
    "protocol",
    "scheme",
    "service"
   ]
  },
  "Gio.Notification": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.OutputStream": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.Permission": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "allowed",
    "can-acquire",
    "can-release"
   ]
  },
  "Gio.PropertyAction": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Action"
   ],
   "properties": [
    "enabled",
    "invert-boolean",
    "name",
    "object",
    "parameter-type",
    "property-name",
    "state",
    "state-type"
   ]
  },
  "Gio.ProxyAddress": {
   "parent": "Gio.InetSocketAddress",
   "implements": [
    "Gio.SocketConnectable"
   ],
   "properties": [
    "destination-hostname",
    "destination-port",
    "destination-protocol",
    "password",
    "protocol",
    "uri",
    "username"
   ]
  },
  "Gio.ProxyAddressEnumerator": {
   "parent": "Gio.SocketAddressEnumerator",
   "implements": [],
   "properties": [
    "connectable",
    "default-port",
    "proxy-resolver",
    "uri"
   ]
  },
  "Gio.Resolver": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "timeout"
   ]
  },
  "Gio.Settings": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "backend",
    "delay-apply",
    "has-unapplied",
    "path",
    "schema",
    "schema-id",
    "settings-schema"
   ]
  },
  "Gio.SettingsBackend": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.SimpleAction": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Action"
   ],
   "properties": [
    "enabled",
    "name",
    "parameter-type",
    "state",
    "state-type"
   ]
  },
  "Gio.SimpleActionGroup": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ActionGroup",
    "Gio.ActionMap"
   ],
   "properties": []
  },
  "Gio.SimpleAsyncResult": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.AsyncResult"
   ],
   "properties": []
  },
  "Gio.SimpleIOStream": {
   "parent": "Gio.IOStream",
   "implements": [],
   "properties": [
    "input-stream",
    "output-stream"
   ]
  },
  "Gio.SimplePermission": {
   "parent": "Gio.Permission",
   "implements": [],
   "properties": []
  },
  "Gio.SimpleProxyResolver": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ProxyResolver"
   ],
   "properties": [
    "default-proxy",
    "ignore-hosts"
   ]
  },
  "Gio.Socket": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.DatagramBased",
    "Gio.Initable"
   ],
   "properties": [
    "blocking",
    "broadcast",
    "family",
    "fd",
    "keepalive",
    "listen-backlog",
    "local-address",
    "multicast-loopback",
    "multicast-ttl",
    "protocol",
    "remote-address",
    "timeout",
    "ttl",
    "type"
   ]
  },
  "Gio.SocketAddress": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.SocketConnectable"
   ],
   "properties": [
    "family"
   ]
  },
  "Gio.SocketAddressEnumerator": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.SocketClient": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "enable-proxy",
    "family",
    "local-address",
    "protocol",
    "proxy-resolver",
    "timeout",
    "tls",
    "tls-validation-flags",
    "type"
   ]
  },
  "Gio.SocketConnection": {
   "parent": "Gio.IOStream",
   "implements": [],
   "properties": [
    "socket"
   ]
  },
  "Gio.SocketControlMessage": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.SocketListener": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "listen-backlog"
   ]
  },
  "Gio.SocketService": {
   "parent": "Gio.SocketListener",
   "implements": [],
   "properties": [
    "active"
   ]
  },
  "Gio.Subprocess": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Initable"
   ],
   "properties": [
    "argv",
    "flags"
   ]
  },
  "Gio.SubprocessLauncher": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "flags"
   ]
  },
  "Gio.Task": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.AsyncResult"
   ],
   "properties": [
    "completed"
   ]
  },
  "Gio.TcpConnection": {
   "parent": "Gio.SocketConnection",
   "implements": [],
   "properties": [
    "graceful-disconnect"
   ]
  },
  "Gio.TcpWrapperConnection": {
   "parent": "Gio.TcpConnection",
   "implements": [],
   "properties": [
    "base-io-stream"
   ]
  },
  "Gio.TestDBus": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "flags"
   ]
  },
  "Gio.ThemedIcon": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Icon"
   ],
   "properties": [
    "name",
    "names",
    "use-default-fallbacks"
   ]
  },
  "Gio.ThreadedResolver": {
   "parent": "Gio.Resolver",
   "implements": [],
   "properties": []
  },
  "Gio.ThreadedSocketService": {
   "parent": "Gio.SocketService",
   "implements": [],
   "properties": [
    "max-threads"
   ]
  },
  "Gio.TlsCertificate": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "certificate",
    "certificate-pem",
    "dns-names",
    "ip-addresses",
    "issuer",
    "issuer-name",
    "not-valid-after",
    "not-valid-before",
    "password",
    "pkcs11-uri",
    "pkcs12-data",
    "private-key",
    "private-key-pem",
    "private-key-pkcs11-uri",
    "subject-name"
   ]
  },
  "Gio.TlsConnection": {
   "parent": "Gio.IOStream",
   "implements": [],
   "properties": [
    "advertised-protocols",
    "base-io-stream",
    "certificate",
    "ciphersuite-name",
    "database",
    "interaction",
    "negotiated-protocol",
    "peer-certificate",
    "peer-certificate-errors",
    "protocol-version",
    "rehandshake-mode",
    "require-close-notify",
    "use-system-certdb"
   ]
  },
  "Gio.TlsDatabase": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.TlsInteraction": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.TlsPassword": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "description",
    "flags",
    "warning"
   ]
  },
  "Gio.UnixConnection": {
   "parent": "Gio.SocketConnection",
   "implements": [],
   "properties": []
  },
  "Gio.UnixCredentialsMessage": {
   "parent": "Gio.SocketControlMessage",
   "implements": [],
   "properties": [
    "credentials"
   ]
  },
  "Gio.UnixFDList": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.UnixSocketAddress": {
   "parent": "Gio.SocketAddress",
   "implements": [
    "Gio.SocketConnectable"
   ],
   "properties": [
    "abstract",
    "address-type",
    "path",
    "path-as-array"
   ]
  },
  "Gio.Vfs": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.VolumeMonitor": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gio.ZlibCompressor": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Converter"
   ],
   "properties": [
    "file-info",
    "format",
    "level",
    "os"
   ]
  },
  "Gio.ZlibDecompressor": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.Converter"
   ],
   "properties": [
    "file-info",
    "format"
   ]
  },
  "Gtk.ATContext": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accessible",
    "accessible-role",
    "display"
   ]
  },
  "Gtk.AboutDialog": {
   "parent": "Gtk.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "artists",
    "authors",
    "comments",
    "copyright",
    "documenters",
    "license",
    "license-type",
    "logo",
    "logo-icon-name",
    "program-name",
    "system-information",
    "translator-credits",
    "version",
    "website",
    "website-label",
    "wrap-license"
   ]
  },
  "Gtk.ActionBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "revealed"
   ]
  },
  "Gtk.ActivateAction": {
   "parent": "Gtk.ShortcutAction",
   "implements": [],
   "properties": []
  },
  "Gtk.Adjustment": {
   "parent": "GObject.InitiallyUnowned",
   "implements": [],
   "properties": [
    "lower",
    "page-increment",
    "page-size",
    "step-increment",
    "upper",
    "value"
   ]
  },
  "Gtk.AlertDialog": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "buttons",
    "cancel-button",
    "default-button",
    "detail",
    "message",
    "modal"
   ]
  },
  "Gtk.AlternativeTrigger": {
   "parent": "Gtk.ShortcutTrigger",
   "implements": [],
   "properties": [
    "first",
    "second"
   ]
  },
  "Gtk.AnyFilter": {
   "parent": "Gtk.MultiFilter",
   "implements": [
    "Gio.ListModel",
    "Gtk.Buildable"
   ],
   "properties": []
  },
  "Gtk.AppChooserButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AppChooser",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "heading",
    "modal",
    "show-default-item",
    "show-dialog-item"
   ]
  },
  "Gtk.AppChooserDialog": {
   "parent": "Gtk.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AppChooser",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "gfile",
    "heading"
   ]
  },
  "Gtk.AppChooserWidget": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AppChooser",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "default-text",
    "show-all",
    "show-default",
    "show-fallback",
    "show-other",
    "show-recommended"
   ]
  },
  "Gtk.Application": {
   "parent": "Gio.Application",
   "implements": [
    "Gio.ActionGroup",
    "Gio.ActionMap"
   ],
   "properties": [
    "active-window",
    "menubar",
    "register-session",
    "screensaver-active"
   ]
  },
  "Gtk.ApplicationWindow": {
   "parent": "Gtk.Window",
   "implements": [
    "Gio.ActionGroup",
    "Gio.ActionMap",
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "show-menubar"
   ]
  },
  "Gtk.AspectFrame": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "obey-child",
    "ratio",
    "xalign",
    "yalign"
   ]
  },
  "Gtk.Assistant": {
   "parent": "Gtk.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "pages",
    "use-header-bar"
   ]
  },
  "Gtk.AssistantPage": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "child",
    "complete",
    "page-type",
    "title"
   ]
  },
  "Gtk.BinLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [],
   "properties": []
  },
  "Gtk.BookmarkList": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel"
   ],
   "properties": [
    "attributes",
    "filename",
    "io-priority",
    "item-type",
    "loading",
    "n-items"
   ]
  },
  "Gtk.BoolFilter": {
   "parent": "Gtk.Filter",
   "implements": [],
   "properties": [
    "expression",
    "invert"
   ]
  },
  "Gtk.Box": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "baseline-child",
    "baseline-position",
    "homogeneous",
    "spacing"
   ]
  },
  "Gtk.BoxLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [
    "Gtk.Orientable"
   ],
   "properties": [
    "baseline-child",
    "baseline-position",
    "homogeneous",
    "spacing"
   ]
  },
  "Gtk.Builder": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "current-object",
    "scope",
    "translation-domain"
   ]
  },
  "Gtk.BuilderCScope": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.BuilderScope"
   ],
   "properties": []
  },
  "Gtk.BuilderListItemFactory": {
   "parent": "Gtk.ListItemFactory",
   "implements": [],
   "properties": [
    "bytes",
    "resource",
    "scope"
   ]
  },
  "Gtk.Button": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "can-shrink",
    "child",
    "has-frame",
    "icon-name",
    "label",
    "use-underline"
   ]
  },
  "Gtk.CClosureExpression": {
   "parent": "Gtk.Expression",
   "implements": [],
   "properties": []
  },
  "Gtk.Calendar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "date",
    "day",
    "month",
    "show-day-names",
    "show-heading",
    "show-week-numbers",
    "year"
   ]
  },
  "Gtk.CallbackAction": {
   "parent": "Gtk.ShortcutAction",
   "implements": [],
   "properties": []
  },
  "Gtk.CellArea": {
   "parent": "GObject.InitiallyUnowned",
   "implements": [
    "Gtk.Buildable",
    "Gtk.CellLayout"
   ],
   "properties": [
    "edit-widget",
    "edited-cell",
    "focus-cell"
   ]
  },
  "Gtk.CellAreaBox": {
   "parent": "Gtk.CellArea",
   "implements": [
    "Gtk.Buildable",
    "Gtk.CellLayout",
    "Gtk.Orientable"
   ],
   "properties": [
    "spacing"
   ]
  },
  "Gtk.CellAreaContext": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "area",
    "minimum-height",
    "minimum-width",
    "natural-height",
    "natural-width"
   ]
  },
  "Gtk.CellRenderer": {
   "parent": "GObject.InitiallyUnowned",
   "implements": [],
   "properties": [
    "cell-background",
    "cell-background-rgba",
    "cell-background-set",
    "editing",
    "height",
    "is-expanded",
    "is-expander",
    "mode",
    "sensitive",
    "visible",
    "width",
    "xalign",
    "xpad",
    "yalign",
    "ypad"
   ]
  },
  "Gtk.CellRendererAccel": {
   "parent": "Gtk.CellRendererText",
   "implements": [],
   "properties": [
    "accel-key",
    "accel-mode",
    "accel-mods",
    "keycode"
   ]
  },
  "Gtk.CellRendererCombo": {
   "parent": "Gtk.CellRendererText",
   "implements": [],
   "properties": [
    "has-entry",
    "model",
    "text-column"
   ]
  },
  "Gtk.CellRendererPixbuf": {
   "parent": "Gtk.CellRenderer",
   "implements": [],
   "properties": [
    "gicon",
    "icon-name",
    "icon-size",
    "pixbuf",
    "pixbuf-expander-closed",
    "pixbuf-expander-open",
    "texture"
   ]
  },
  "Gtk.CellRendererProgress": {
   "parent": "Gtk.CellRenderer",
   "implements": [
    "Gtk.Orientable"
   ],
   "properties": [
    "inverted",
    "pulse",
    "text",
    "text-xalign",
    "text-yalign",
    "value"
   ]
  },
  "Gtk.CellRendererSpin": {
   "parent": "Gtk.CellRendererText",
   "implements": [],
   "properties": [
    "adjustment",
    "climb-rate",
    "digits"
   ]
  },
  "Gtk.CellRendererSpinner": {
   "parent": "Gtk.CellRenderer",
   "implements": [],
   "properties": [
    "active",
    "pulse",
    "size"
   ]
  },
  "Gtk.CellRendererText": {
   "parent": "Gtk.CellRenderer",
   "implements": [],
   "properties": [
    "align-set",
    "alignment",
    "attributes",
    "background",
    "background-rgba",
    "background-set",
    "editable",
    "editable-set",
    "ellipsize",
    "ellipsize-set",
    "family",
    "family-set",
    "font",
    "font-desc",
    "foreground",
    "foreground-rgba",
    "foreground-set",
    "language",
    "language-set",
    "markup",
    "max-width-chars",
    "placeholder-text",
    "rise",
    "rise-set",
    "scale",
    "scale-set",
    "single-paragraph-mode",
    "size",
    "size-points",
    "size-set",
    "stretch",
    "stretch-set",
    "strikethrough",
    "strikethrough-set",
    "style",
    "style-set",
    "text",
    "underline",
    "underline-set",
    "variant",
    "variant-set",
    "weight",
    "weight-set",
    "width-chars",
    "wrap-mode",
    "wrap-width"
   ]
  },
  "Gtk.CellRendererToggle": {
   "parent": "Gtk.CellRenderer",
   "implements": [],
   "properties": [
    "activatable",
    "active",
    "inconsistent",
    "radio"
   ]
  },
  "Gtk.CellView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.CellLayout",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "cell-area",
    "cell-area-context",
    "draw-sensitive",
    "fit-model",
    "model"
   ]
  },
  "Gtk.CenterBox": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "baseline-position",
    "center-widget",
    "end-widget",
    "shrink-center-last",
    "start-widget"
   ]
  },
  "Gtk.CenterLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [],
   "properties": [
    "shrink-center-last"
   ]
  },
  "Gtk.CheckButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "active",
    "child",
    "group",
    "inconsistent",
    "label",
    "use-underline"
   ]
  },
  "Gtk.ClosureExpression": {
   "parent": "Gtk.Expression",
   "implements": [],
   "properties": []
  },
  "Gtk.ColorButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ColorChooser",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "modal",
    "show-editor",
    "title"
   ]
  },
  "Gtk.ColorChooserDialog": {
   "parent": "Gtk.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ColorChooser",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "show-editor"
   ]
  },
  "Gtk.ColorChooserWidget": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ColorChooser",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "show-editor"
   ]
  },
  "Gtk.ColorDialog": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "modal",
    "title",
    "with-alpha"
   ]
  },
  "Gtk.ColorDialogButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "dialog",
    "rgba"
   ]
  },
  "Gtk.ColumnView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Scrollable"
   ],
   "properties": [
    "columns",
    "enable-rubberband",
    "header-factory",
    "model",
    "reorderable",
    "row-factory",
    "show-column-separators",
    "show-row-separators",
    "single-click-activate",
    "sorter",
    "tab-behavior"
   ]
  },
  "Gtk.ColumnViewCell": {
   "parent": "Gtk.ListItem",
   "implements": [],
   "properties": [
    "child",
    "focusable",
    "item",
    "position",
    "selected"
   ]
  },
  "Gtk.ColumnViewColumn": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "column-view",
    "expand",
    "factory",
    "fixed-width",
    "header-menu",
    "id",
    "resizable",
    "sorter",
    "title",
    "visible"
   ]
  },
  "Gtk.ColumnViewRow": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accessible-description",
    "accessible-label",
    "activatable",
    "focusable",
    "item",
    "position",
    "selectable",
    "selected"
   ]
  },
  "Gtk.ColumnViewSorter": {
   "parent": "Gtk.Sorter",
   "implements": [],
   "properties": [
    "primary-sort-column",
    "primary-sort-order"
   ]
  },
  "Gtk.ComboBox": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.CellEditable",
    "Gtk.CellLayout",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "active",
    "active-id",
    "button-sensitivity",
    "child",
    "entry-text-column",
    "has-entry",
    "has-frame",
    "id-column",
    "model",
    "popup-fixed-width",
    "popup-shown"
   ]
  },
  "Gtk.ComboBoxText": {
   "parent": "Gtk.ComboBox",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.CellEditable",
    "Gtk.CellLayout",
    "Gtk.ConstraintTarget"
   ],
   "properties": []
  },
  "Gtk.ConstantExpression": {
   "parent": "Gtk.Expression",
   "implements": [],
   "properties": []
  },
  "Gtk.Constraint": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "constant",
    "multiplier",
    "relation",
    "source",
    "source-attribute",
    "strength",
    "target",
    "target-attribute"
   ]
  },
  "Gtk.ConstraintGuide": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "max-height",
    "max-width",
    "min-height",
    "min-width",
    "name",
    "nat-height",
    "nat-width",
    "strength"
   ]
  },
  "Gtk.ConstraintLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [
    "Gtk.Buildable"
   ],
   "properties": []
  },
  "Gtk.ConstraintLayoutChild": {
   "parent": "Gtk.LayoutChild",
   "implements": [],
   "properties": []
  },
  "Gtk.CssProvider": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.StyleProvider"
   ],
   "properties": [
    "prefers-color-scheme",
    "prefers-contrast"
   ]
  },
  "Gtk.CustomFilter": {
   "parent": "Gtk.Filter",
   "implements": [],
   "properties": []
  },
  "Gtk.CustomLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [],
   "properties": []
  },
  "Gtk.CustomSorter": {
   "parent": "Gtk.Sorter",
   "implements": [],
   "properties": []
  },
  "Gtk.Dialog": {
   "parent": "Gtk.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "use-header-bar"
   ]
  },
  "Gtk.DirectoryList": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel"
   ],
   "properties": [
    "attributes",
    "error",
    "file",
    "io-priority",
    "item-type",
    "loading",
    "monitored",
    "n-items"
   ]
  },
  "Gtk.DragIcon": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root"
   ],
   "properties": [
    "child"
   ]
  },
  "Gtk.DragSource": {
   "parent": "Gtk.GestureSingle",
   "implements": [],
   "properties": [
    "actions",
    "content"
   ]
  },
  "Gtk.DrawingArea": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "content-height",
    "content-width"
   ]
  },
  "Gtk.DropControllerMotion": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "contains-pointer",
    "drop",
    "is-pointer"
   ]
  },
  "Gtk.DropDown": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "enable-search",
    "expression",
    "factory",
    "header-factory",
    "list-factory",
    "model",
    "search-match-mode",
    "selected",
    "selected-item",
    "show-arrow"
   ]
  },
  "Gtk.DropTarget": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "actions",
    "current-drop",
    "drop",
    "formats",
    "preload",
    "value"
   ]
  },
  "Gtk.DropTargetAsync": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "actions",
    "formats"
   ]
  },
  "Gtk.EditableLabel": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": [
    "editing"
   ]
  },
  "Gtk.EmojiChooser": {
   "parent": "Gtk.Popover",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.ShortcutManager"
   ],
   "properties": []
  },
  "Gtk.Entry": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.CellEditable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": [
    "activates-default",
    "attributes",
    "buffer",
    "completion",
    "enable-emoji-completion",
    "extra-menu",
    "has-frame",
    "im-module",
    "input-hints",
    "input-purpose",
    "invisible-char",
    "invisible-char-set",
    "max-length",
    "menu-entry-icon-primary-text",
    "menu-entry-icon-secondary-text",
    "overwrite-mode",
    "placeholder-text",
    "primary-icon-activatable",
    "primary-icon-gicon",
    "primary-icon-name",
    "primary-icon-paintable",
    "primary-icon-sensitive",
    "primary-icon-storage-type",
    "primary-icon-tooltip-markup",
    "primary-icon-tooltip-text",
    "progress-fraction",
    "progress-pulse-step",
    "scroll-offset",
    "secondary-icon-activatable",
    "secondary-icon-gicon",
    "secondary-icon-name",
    "secondary-icon-paintable",
    "secondary-icon-sensitive",
    "secondary-icon-storage-type",
    "secondary-icon-tooltip-markup",
    "secondary-icon-tooltip-text",
    "show-emoji-icon",
    "tabs",
    "text-length",
    "truncate-multiline",
    "visibility"
   ]
  },
  "Gtk.EntryBuffer": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "length",
    "max-length",
    "text"
   ]
  },
  "Gtk.EntryCompletion": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Buildable",
    "Gtk.CellLayout"
   ],
   "properties": [
    "cell-area",
    "inline-completion",
    "inline-selection",
    "minimum-key-length",
    "model",
    "popup-completion",
    "popup-set-width",
    "popup-single-match",
    "text-column"
   ]
  },
  "Gtk.EventController": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "name",
    "propagation-limit",
    "propagation-phase",
    "widget"
   ]
  },
  "Gtk.EventControllerFocus": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "contains-focus",
    "is-focus"
   ]
  },
  "Gtk.EventControllerKey": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": []
  },
  "Gtk.EventControllerLegacy": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": []
  },
  "Gtk.EventControllerMotion": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "contains-pointer",
    "is-pointer"
   ]
  },
  "Gtk.EventControllerScroll": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "flags"
   ]
  },
  "Gtk.EveryFilter": {
   "parent": "Gtk.MultiFilter",
   "implements": [
    "Gio.ListModel",
    "Gtk.Buildable"
   ],
   "properties": []
  },
  "Gtk.Expander": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "expanded",
    "label",
    "label-widget",
    "resize-toplevel",
    "use-markup",
    "use-underline"
   ]
  },
  "Gtk.Expression": {
   "parent": null,
   "implements": [],
   "properties": []
  },
  "Gtk.FileChooserDialog": {
   "parent": "Gtk.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.FileChooser",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": []
  },
  "Gtk.FileChooserNative": {
   "parent": "Gtk.NativeDialog",
   "implements": [
    "Gtk.FileChooser"
   ],
   "properties": [
    "accept-label",
    "cancel-label"
   ]
  },
  "Gtk.FileChooserWidget": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.FileChooser"
   ],
   "properties": [
    "search-mode",
    "show-time",
    "subtitle"
   ]
  },
  "Gtk.FileDialog": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accept-label",
    "default-filter",
    "filters",
    "initial-file",
    "initial-folder",
    "initial-name",
    "modal",
    "title"
   ]
  },
  "Gtk.FileFilter": {
   "parent": "Gtk.Filter",
   "implements": [
    "Gtk.Buildable"
   ],
   "properties": [
    "mime-types",
    "name",
    "patterns",
    "suffixes"
   ]
  },
  "Gtk.FileLauncher": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "always-ask",
    "file",
    "writable"
   ]
  },
  "Gtk.Filter": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.FilterListModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel"
   ],
   "properties": [
    "filter",
    "incremental",
    "item-type",
    "model",
    "n-items",
    "pending",
    "watch-items"
   ]
  },
  "Gtk.Fixed": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": []
  },
  "Gtk.FixedLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [],
   "properties": []
  },
  "Gtk.FixedLayoutChild": {
   "parent": "Gtk.LayoutChild",
   "implements": [],
   "properties": [
    "transform"
   ]
  },
  "Gtk.FlattenListModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel"
   ],
   "properties": [
    "item-type",
    "model",
    "n-items"
   ]
  },
  "Gtk.FlowBox": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "accept-unpaired-release",
    "activate-on-single-click",
    "column-spacing",
    "homogeneous",
    "max-children-per-line",
    "min-children-per-line",
    "row-spacing",
    "selection-mode"
   ]
  },
  "Gtk.FlowBoxChild": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child"
   ]
  },
  "Gtk.FontButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.FontChooser"
   ],
   "properties": [
    "modal",
    "title",
    "use-font",
    "use-size"
   ]
  },
  "Gtk.FontChooserDialog": {
   "parent": "Gtk.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.FontChooser",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": []
  },
  "Gtk.FontChooserWidget": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.FontChooser"
   ],
   "properties": [
    "tweak-action"
   ]
  },
  "Gtk.FontDialog": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "filter",
    "font-map",
    "language",
    "modal",
    "title"
   ]
  },
  "Gtk.FontDialogButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "dialog",
    "font-desc",
    "font-features",
    "language",
    "level",
    "use-font",
    "use-size"
   ]
  },
  "Gtk.Frame": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "label",
    "label-widget",
    "label-xalign"
   ]
  },
  "Gtk.GLArea": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "allowed-apis",
    "api",
    "auto-render",
    "context",
    "has-depth-buffer",
    "has-stencil-buffer",
    "use-es"
   ]
  },
  "Gtk.Gesture": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "n-points"
   ]
  },
  "Gtk.GestureClick": {
   "parent": "Gtk.GestureSingle",
   "implements": [],
   "properties": []
  },
  "Gtk.GestureDrag": {
   "parent": "Gtk.GestureSingle",
   "implements": [],
   "properties": []
  },
  "Gtk.GestureLongPress": {
   "parent": "Gtk.GestureSingle",
   "implements": [],
   "properties": [
    "delay-factor"
   ]
  },
  "Gtk.GesturePan": {
   "parent": "Gtk.GestureDrag",
   "implements": [],
   "properties": [
    "orientation"
   ]
  },
  "Gtk.GestureRotate": {
   "parent": "Gtk.Gesture",
   "implements": [],
   "properties": []
  },
  "Gtk.GestureSingle": {
   "parent": "Gtk.Gesture",
   "implements": [],
   "properties": [
    "button",
    "exclusive",
    "touch-only"
   ]
  },
  "Gtk.GestureStylus": {
   "parent": "Gtk.GestureSingle",
   "implements": [],
   "properties": [
    "stylus-only"
   ]
  },
  "Gtk.GestureSwipe": {
   "parent": "Gtk.GestureSingle",
   "implements": [],
   "properties": []
  },
  "Gtk.GestureZoom": {
   "parent": "Gtk.Gesture",
   "implements": [],
   "properties": []
  },
  "Gtk.GraphicsOffload": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "black-background",
    "child",
    "enabled"
   ]
  },
  "Gtk.Grid": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "baseline-row",
    "column-homogeneous",
    "column-spacing",
    "row-homogeneous",
    "row-spacing"
   ]
  },
  "Gtk.GridLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [],
   "properties": [
    "baseline-row",
    "column-homogeneous",
    "column-spacing",
    "row-homogeneous",
    "row-spacing"
   ]
  },
  "Gtk.GridLayoutChild": {
   "parent": "Gtk.LayoutChild",
   "implements": [],
   "properties": [
    "column",
    "column-span",
    "row",
    "row-span"
   ]
  },
  "Gtk.GridView": {
   "parent": "Gtk.ListBase",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable",
    "Gtk.Scrollable"
   ],
   "properties": [
    "enable-rubberband",
    "factory",
    "max-columns",
    "min-columns",
    "model",
    "single-click-activate",
    "tab-behavior"
   ]
  },
  "Gtk.HeaderBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "decoration-layout",
    "show-title-buttons",
    "title-widget",
    "use-native-controls"
   ]
  },
  "Gtk.IMContext": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "input-hints",
    "input-purpose"
   ]
  },
  "Gtk.IMContextSimple": {
   "parent": "Gtk.IMContext",
   "implements": [],
   "properties": []
  },
  "Gtk.IMMulticontext": {
   "parent": "Gtk.IMContext",
   "implements": [],
   "properties": []
  },
  "Gtk.IconPaintable": {
   "parent": "GObject.Object",
   "implements": [
    "Gdk.Paintable",
    "Gtk.SymbolicPaintable"
   ],
   "properties": [
    "file",
    "icon-name",
    "is-symbolic",
    "scale",
    "size"
   ]
  },
  "Gtk.IconTheme": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "display",
    "icon-names",
    "resource-path",
    "search-path",
    "theme-name"
   ]
  },
  "Gtk.IconView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.CellLayout",
    "Gtk.ConstraintTarget",
    "Gtk.Scrollable"
   ],
   "properties": [
    "activate-on-single-click",
    "cell-area",
    "column-spacing",
    "columns",
    "item-orientation",
    "item-padding",
    "item-width",
    "margin",
    "markup-column",
    "model",
    "pixbuf-column",
    "reorderable",
    "row-spacing",
    "selection-mode",
    "spacing",
    "text-column",
    "tooltip-column"
   ]
  },
  "Gtk.Image": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "file",
    "gicon",
    "icon-name",
    "icon-size",
    "paintable",
    "pixel-size",
    "resource",
    "storage-type",
    "use-fallback"
   ]
  },
  "Gtk.InfoBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "message-type",
    "revealed",
    "show-close-button"
   ]
  },
  "Gtk.Inscription": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleText",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "attributes",
    "markup",
    "min-chars",
    "min-lines",
    "nat-chars",
    "nat-lines",
    "text",
    "text-overflow",
    "wrap-mode",
    "xalign",
    "yalign"
   ]
  },
  "Gtk.KeyvalTrigger": {
   "parent": "Gtk.ShortcutTrigger",
   "implements": [],
   "properties": [
    "keyval",
    "modifiers"
   ]
  },
  "Gtk.Label": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleText",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "attributes",
    "ellipsize",
    "extra-menu",
    "justify",
    "label",
    "lines",
    "max-width-chars",
    "mnemonic-keyval",
    "mnemonic-widget",
    "natural-wrap-mode",
    "selectable",
    "single-line-mode",
    "tabs",
    "use-markup",
    "use-underline",
    "width-chars",
    "wrap",
    "wrap-mode",
    "xalign",
    "yalign"
   ]
  },
  "Gtk.LayoutChild": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "child-widget",
    "layout-manager"
   ]
  },
  "Gtk.LayoutManager": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.LevelBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "inverted",
    "max-value",
    "min-value",
    "mode",
    "value"
   ]
  },
  "Gtk.LinkButton": {
   "parent": "Gtk.Button",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "uri",
    "visited"
   ]
  },
  "Gtk.ListBase": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable",
    "Gtk.Scrollable"
   ],
   "properties": [
    "orientation"
   ]
  },
  "Gtk.ListBox": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "accept-unpaired-release",
    "activate-on-single-click",
    "selection-mode",
    "show-separators",
    "tab-behavior"
   ]
  },
  "Gtk.ListBoxRow": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "activatable",
    "child",
    "selectable"
   ]
  },
  "Gtk.ListHeader": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "child",
    "end",
    "item",
    "n-items",
    "start"
   ]
  },
  "Gtk.ListItem": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accessible-description",
    "accessible-label",
    "activatable",
    "child",
    "focusable",
    "item",
    "position",
    "selectable",
    "selected"
   ]
  },
  "Gtk.ListItemFactory": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.ListStore": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Buildable",
    "Gtk.TreeDragDest",
    "Gtk.TreeDragSource",
    "Gtk.TreeModel",
    "Gtk.TreeSortable"
   ],
   "properties": []
  },
  "Gtk.ListView": {
   "parent": "Gtk.ListBase",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable",
    "Gtk.Scrollable"
   ],
   "properties": [
    "enable-rubberband",
    "factory",
    "header-factory",
    "model",
    "show-separators",
    "single-click-activate",
    "tab-behavior"
   ]
  },
  "Gtk.LockButton": {
   "parent": "Gtk.Button",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "permission",
    "text-lock",
    "text-unlock",
    "tooltip-lock",
    "tooltip-not-authorized",
    "tooltip-unlock"
   ]
  },
  "Gtk.MapListModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel"
   ],
   "properties": [
    "has-map",
    "item-type",
    "model",
    "n-items"
   ]
  },
  "Gtk.MediaControls": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "media-stream"
   ]
  },
  "Gtk.MediaFile": {
   "parent": "Gtk.MediaStream",
   "implements": [
    "Gdk.Paintable"
   ],
   "properties": [
    "file",
    "input-stream"
   ]
  },
  "Gtk.MediaStream": {
   "parent": "GObject.Object",
   "implements": [
    "Gdk.Paintable"
   ],
   "properties": [
    "duration",
    "ended",
    "error",
    "has-audio",
    "has-video",
    "loop",
    "muted",
    "playing",
    "prepared",
    "seekable",
    "seeking",
    "timestamp",
    "volume"
   ]
  },
  "Gtk.MenuButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "active",
    "always-show-arrow",
    "can-shrink",
    "child",
    "direction",
    "has-frame",
    "icon-name",
    "label",
    "menu-model",
    "popover",
    "primary",
    "use-underline"
   ]
  },
  "Gtk.MessageDialog": {
   "parent": "Gtk.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "buttons",
    "message-area",
    "message-type",
    "secondary-text",
    "secondary-use-markup",
    "text",
    "use-markup"
   ]
  },
  "Gtk.MnemonicAction": {
   "parent": "Gtk.ShortcutAction",
   "implements": [],
   "properties": []
  },
  "Gtk.MnemonicTrigger": {
   "parent": "Gtk.ShortcutTrigger",
   "implements": [],
   "properties": [
    "keyval"
   ]
  },
  "Gtk.MountOperation": {
   "parent": "Gio.MountOperation",
   "implements": [],
   "properties": [
    "display",
    "is-showing",
    "parent"
   ]
  },
  "Gtk.MultiFilter": {
   "parent": "Gtk.Filter",
   "implements": [
    "Gio.ListModel",
    "Gtk.Buildable"
   ],
   "properties": [
    "item-type",
    "n-items"
   ]
  },
  "Gtk.MultiSelection": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel",
    "Gtk.SelectionModel"
   ],
   "properties": [
    "item-type",
    "model",
    "n-items"
   ]
  },
  "Gtk.MultiSorter": {
   "parent": "Gtk.Sorter",
   "implements": [
    "Gio.ListModel",
    "Gtk.Buildable"
   ],
   "properties": [
    "item-type",
    "n-items"
   ]
  },
  "Gtk.NamedAction": {
   "parent": "Gtk.ShortcutAction",
   "implements": [],
   "properties": [
    "action-name"
   ]
  },
  "Gtk.NativeDialog": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "modal",
    "title",
    "transient-for",
    "visible"
   ]
  },
  "Gtk.NeverTrigger": {
   "parent": "Gtk.ShortcutTrigger",
   "implements": [],
   "properties": []
  },
  "Gtk.NoSelection": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel",
    "Gtk.SelectionModel"
   ],
   "properties": [
    "item-type",
    "model",
    "n-items"
   ]
  },
  "Gtk.Notebook": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "enable-popup",
    "group-name",
    "page",
    "pages",
    "scrollable",
    "show-border",
    "show-tabs",
    "tab-pos"
   ]
  },
  "Gtk.NotebookPage": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "child",
    "detachable",
    "menu",
    "menu-label",
    "position",
    "reorderable",
    "tab",
    "tab-expand",
    "tab-fill",
    "tab-label"
   ]
  },
  "Gtk.NothingAction": {
   "parent": "Gtk.ShortcutAction",
   "implements": [],
   "properties": []
  },
  "Gtk.NumericSorter": {
   "parent": "Gtk.Sorter",
   "implements": [],
   "properties": [
    "expression",
    "sort-order"
   ]
  },
  "Gtk.ObjectExpression": {
   "parent": "Gtk.Expression",
   "implements": [],
   "properties": []
  },
  "Gtk.Overlay": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child"
   ]
  },
  "Gtk.OverlayLayout": {
   "parent": "Gtk.LayoutManager",
   "implements": [],
   "properties": []
  },
  "Gtk.OverlayLayoutChild": {
   "parent": "Gtk.LayoutChild",
   "implements": [],
   "properties": [
    "clip-overlay",
    "measure"
   ]
  },
  "Gtk.PadController": {
   "parent": "Gtk.EventController",
   "implements": [],
   "properties": [
    "action-group",
    "pad"
   ]
  },
  "Gtk.PageSetup": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.PageSetupUnixDialog": {
   "parent": "Gtk.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": []
  },
  "Gtk.Paned": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "end-child",
    "max-position",
    "min-position",
    "position",
    "position-set",
    "resize-end-child",
    "resize-start-child",
    "shrink-end-child",
    "shrink-start-child",
    "start-child",
    "wide-handle"
   ]
  },
  "Gtk.ParamSpecExpression": {
   "parent": "GObject.ParamSpec",
   "implements": [],
   "properties": []
  },
  "Gtk.PasswordEntry": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": [
    "activates-default",
    "extra-menu",
    "placeholder-text",
    "show-peek-icon"
   ]
  },
  "Gtk.PasswordEntryBuffer": {
   "parent": "Gtk.EntryBuffer",
   "implements": [],
   "properties": []
  },
  "Gtk.Picture": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "alternative-text",
    "can-shrink",
    "content-fit",
    "file",
    "keep-aspect-ratio",
    "paintable"
   ]
  },
  "Gtk.Popover": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "autohide",
    "cascade-popdown",
    "child",
    "default-widget",
    "has-arrow",
    "mnemonics-visible",
    "pointing-to",
    "position"
   ]
  },
  "Gtk.PopoverMenu": {
   "parent": "Gtk.Popover",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "flags",
    "menu-model",
    "visible-submenu"
   ]
  },
  "Gtk.PopoverMenuBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "menu-model"
   ]
  },
  "Gtk.PrintContext": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.PrintDialog": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accept-label",
    "modal",
    "page-setup",
    "print-settings",
    "title"
   ]
  },
  "Gtk.PrintJob": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "page-setup",
    "printer",
    "settings",
    "title",
    "track-print-status"
   ]
  },
  "Gtk.PrintOperation": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.PrintOperationPreview"
   ],
   "properties": [
    "allow-async",
    "current-page",
    "custom-tab-label",
    "default-page-setup",
    "embed-page-setup",
    "export-filename",
    "has-selection",
    "job-name",
    "n-pages",
    "n-pages-to-print",
    "print-settings",
    "show-progress",
    "status",
    "status-string",
    "support-selection",
    "track-print-status",
    "unit",
    "use-full-page"
   ]
  },
  "Gtk.PrintSettings": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.PrintUnixDialog": {
   "parent": "Gtk.Dialog",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "current-page",
    "embed-page-setup",
    "has-selection",
    "manual-capabilities",
    "page-setup",
    "print-settings",
    "selected-printer",
    "support-selection"
   ]
  },
  "Gtk.Printer": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accepting-jobs",
    "accepts-pdf",
    "accepts-ps",
    "backend",
    "icon-name",
    "is-virtual",
    "job-count",
    "location",
    "name",
    "paused",
    "state-message"
   ]
  },
  "Gtk.ProgressBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "ellipsize",
    "fraction",
    "inverted",
    "pulse-step",
    "show-text",
    "text"
   ]
  },
  "Gtk.PropertyExpression": {
   "parent": "Gtk.Expression",
   "implements": [],
   "properties": []
  },
  "Gtk.Range": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "adjustment",
    "fill-level",
    "inverted",
    "restrict-to-fill-level",
    "round-digits",
    "show-fill-level"
   ]
  },
  "Gtk.RecentManager": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "filename",
    "size"
   ]
  },
  "Gtk.Revealer": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "child-revealed",
    "reveal-child",
    "transition-duration",
    "transition-type"
   ]
  },
  "Gtk.Scale": {
   "parent": "Gtk.Range",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "digits",
    "draw-value",
    "has-origin",
    "value-pos"
   ]
  },
  "Gtk.ScaleButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "active",
    "adjustment",
    "has-frame",
    "icons",
    "value"
   ]
  },
  "Gtk.Scrollbar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "adjustment"
   ]
  },
  "Gtk.ScrolledWindow": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "hadjustment",
    "has-frame",
    "hscrollbar-policy",
    "kinetic-scrolling",
    "max-content-height",
    "max-content-width",
    "min-content-height",
    "min-content-width",
    "overlay-scrolling",
    "propagate-natural-height",
    "propagate-natural-width",
    "vadjustment",
    "vscrollbar-policy",
    "window-placement"
   ]
  },
  "Gtk.SearchBar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "key-capture-widget",
    "search-mode-enabled",
    "show-close-button"
   ]
  },
  "Gtk.SearchEntry": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": [
    "activates-default",
    "input-hints",
    "input-purpose",
    "placeholder-text",
    "search-delay"
   ]
  },
  "Gtk.SelectionFilterModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel"
   ],
   "properties": [
    "item-type",
    "model",
    "n-items"
   ]
  },
  "Gtk.Separator": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": []
  },
  "Gtk.Settings": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.StyleProvider"
   ],
   "properties": [
    "gtk-alternative-button-order",
    "gtk-alternative-sort-arrows",
    "gtk-application-prefer-dark-theme",
    "gtk-cursor-aspect-ratio",
    "gtk-cursor-blink",
    "gtk-cursor-blink-time",
    "gtk-cursor-blink-timeout",
    "gtk-cursor-theme-name",
    "gtk-cursor-theme-size",
    "gtk-decoration-layout",
    "gtk-dialogs-use-header",
    "gtk-dnd-drag-threshold",
    "gtk-double-click-distance",
    "gtk-double-click-time",
    "gtk-enable-accels",
    "gtk-enable-animations",
    "gtk-enable-event-sounds",
    "gtk-enable-input-feedback-sounds",
    "gtk-enable-primary-paste",
    "gtk-entry-password-hint-timeout",
    "gtk-entry-select-on-focus",
    "gtk-error-bell",
    "gtk-font-name",
    "gtk-font-rendering",
    "gtk-fontconfig-timestamp",
    "gtk-hint-font-metrics",
    "gtk-icon-theme-name",
    "gtk-im-module",
    "gtk-interface-color-scheme",
    "gtk-interface-contrast",
    "gtk-keynav-use-caret",
    "gtk-label-select-on-focus",
    "gtk-long-press-time",
    "gtk-overlay-scrolling",
    "gtk-primary-button-warps-slider",
    "gtk-print-backends",
    "gtk-print-preview-command",
    "gtk-recent-files-enabled",
    "gtk-recent-files-max-age",
    "gtk-shell-shows-app-menu",
    "gtk-shell-shows-desktop",
    "gtk-shell-shows-menubar",
    "gtk-show-status-shapes",
    "gtk-sound-theme-name",
    "gtk-split-cursor",
    "gtk-theme-name",
    "gtk-titlebar-double-click",
    "gtk-titlebar-middle-click",
    "gtk-titlebar-right-click",
    "gtk-xft-antialias",
    "gtk-xft-dpi",
    "gtk-xft-hinting",
    "gtk-xft-hintstyle",
    "gtk-xft-rgba"
   ]
  },
  "Gtk.Shortcut": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "action",
    "arguments",
    "trigger"
   ]
  },
  "Gtk.ShortcutAction": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.ShortcutController": {
   "parent": "Gtk.EventController",
   "implements": [
    "Gio.ListModel",
    "Gtk.Buildable"
   ],
   "properties": [
    "item-type",
    "mnemonic-modifiers",
    "model",
    "n-items",
    "scope"
   ]
  },
  "Gtk.ShortcutLabel": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "accelerator",
    "disabled-text"
   ]
  },
  "Gtk.ShortcutTrigger": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.ShortcutsGroup": {
   "parent": "Gtk.Box",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "accel-size-group",
    "height",
    "title",
    "title-size-group",
    "view"
   ]
  },
  "Gtk.ShortcutsSection": {
   "parent": "Gtk.Box",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "max-height",
    "section-name",
    "title",
    "view-name"
   ]
  },
  "Gtk.ShortcutsShortcut": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "accel-size-group",
    "accelerator",
    "action-name",
    "direction",
    "icon",
    "icon-set",
    "shortcut-type",
    "subtitle",
    "subtitle-set",
    "title",
    "title-size-group"
   ]
  },
  "Gtk.ShortcutsWindow": {
   "parent": "Gtk.Window",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "section-name",
    "view-name"
   ]
  },
  "Gtk.SignalAction": {
   "parent": "Gtk.ShortcutAction",
   "implements": [],
   "properties": [
    "signal-name"
   ]
  },
  "Gtk.SignalListItemFactory": {
   "parent": "Gtk.ListItemFactory",
   "implements": [],
   "properties": []
  },
  "Gtk.SingleSelection": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel",
    "Gtk.SelectionModel"
   ],
   "properties": [
    "autoselect",
    "can-unselect",
    "item-type",
    "model",
    "n-items",
    "selected",
    "selected-item"
   ]
  },
  "Gtk.SizeGroup": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Buildable"
   ],
   "properties": [
    "mode"
   ]
  },
  "Gtk.SliceListModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel"
   ],
   "properties": [
    "item-type",
    "model",
    "n-items",
    "offset",
    "size"
   ]
  },
  "Gtk.Snapshot": {
   "parent": "Gdk.Snapshot",
   "implements": [],
   "properties": []
  },
  "Gtk.SortListModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.SectionModel"
   ],
   "properties": [
    "incremental",
    "item-type",
    "model",
    "n-items",
    "pending",
    "section-sorter",
    "sorter"
   ]
  },
  "Gtk.Sorter": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.SpinButton": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.CellEditable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable",
    "Gtk.Orientable"
   ],
   "properties": [
    "activates-default",
    "adjustment",
    "climb-rate",
    "digits",
    "numeric",
    "snap-to-ticks",
    "update-policy",
    "value",
    "wrap"
   ]
  },
  "Gtk.Spinner": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "spinning"
   ]
  },
  "Gtk.Stack": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "hhomogeneous",
    "interpolate-size",
    "pages",
    "transition-duration",
    "transition-running",
    "transition-type",
    "vhomogeneous",
    "visible-child",
    "visible-child-name"
   ]
  },
  "Gtk.StackPage": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Accessible"
   ],
   "properties": [
    "child",
    "icon-name",
    "name",
    "needs-attention",
    "title",
    "use-underline",
    "visible"
   ]
  },
  "Gtk.StackSidebar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "stack"
   ]
  },
  "Gtk.StackSwitcher": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "stack"
   ]
  },
  "Gtk.Statusbar": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": []
  },
  "Gtk.StringFilter": {
   "parent": "Gtk.Filter",
   "implements": [],
   "properties": [
    "expression",
    "ignore-case",
    "match-mode",
    "search"
   ]
  },
  "Gtk.StringList": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel",
    "Gtk.Buildable"
   ],
   "properties": [
    "item-type",
    "n-items",
    "strings"
   ]
  },
  "Gtk.StringObject": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "string"
   ]
  },
  "Gtk.StringSorter": {
   "parent": "Gtk.Sorter",
   "implements": [],
   "properties": [
    "collation",
    "expression",
    "ignore-case"
   ]
  },
  "Gtk.StyleContext": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "display"
   ]
  },
  "Gtk.Switch": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "active",
    "state"
   ]
  },
  "Gtk.Text": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleText",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Editable"
   ],
   "properties": [
    "activates-default",
    "attributes",
    "buffer",
    "enable-emoji-completion",
    "extra-menu",
    "im-module",
    "input-hints",
    "input-purpose",
    "invisible-char",
    "invisible-char-set",
    "max-length",
    "overwrite-mode",
    "placeholder-text",
    "propagate-text-width",
    "scroll-offset",
    "tabs",
    "truncate-multiline",
    "visibility"
   ]
  },
  "Gtk.TextBuffer": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "can-redo",
    "can-undo",
    "cursor-position",
    "enable-undo",
    "has-selection",
    "tag-table",
    "text"
   ]
  },
  "Gtk.TextChildAnchor": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.TextMark": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "left-gravity",
    "name"
   ]
  },
  "Gtk.TextTag": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "accumulative-margin",
    "allow-breaks",
    "allow-breaks-set",
    "background",
    "background-full-height",
    "background-full-height-set",
    "background-rgba",
    "background-set",
    "direction",
    "editable",
    "editable-set",
    "fallback",
    "fallback-set",
    "family",
    "family-set",
    "font",
    "font-desc",
    "font-features",
    "font-features-set",
    "foreground",
    "foreground-rgba",
    "foreground-set",
    "indent",
    "indent-set",
    "insert-hyphens",
    "insert-hyphens-set",
    "invisible",
    "invisible-set",
    "justification",
    "justification-set",
    "language",
    "language-set",
    "left-margin",
    "left-margin-set",
    "letter-spacing",
    "letter-spacing-set",
    "line-height",
    "line-height-set",
    "name",
    "overline",
    "overline-rgba",
    "overline-rgba-set",
    "overline-set",
    "paragraph-background",
    "paragraph-background-rgba",
    "paragraph-background-set",
    "pixels-above-lines",
    "pixels-above-lines-set",
    "pixels-below-lines",
    "pixels-below-lines-set",
    "pixels-inside-wrap",
    "pixels-inside-wrap-set",
    "right-margin",
    "right-margin-set",
    "rise",
    "rise-set",
    "scale",
    "scale-set",
    "sentence",
    "sentence-set",
    "show-spaces",
    "show-spaces-set",
    "size",
    "size-points",
    "size-set",
    "stretch",
    "stretch-set",
    "strikethrough",
    "strikethrough-rgba",
    "strikethrough-rgba-set",
    "strikethrough-set",
    "style",
    "style-set",
    "tabs",
    "tabs-set",
    "text-transform",
    "text-transform-set",
    "underline",
    "underline-rgba",
    "underline-rgba-set",
    "underline-set",
    "variant",
    "variant-set",
    "weight",
    "weight-set",
    "word",
    "word-set",
    "wrap-mode",
    "wrap-mode-set"
   ]
  },
  "Gtk.TextTagTable": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Buildable"
   ],
   "properties": []
  },
  "Gtk.TextView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleText",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Scrollable"
   ],
   "properties": [
    "accepts-tab",
    "bottom-margin",
    "buffer",
    "cursor-visible",
    "editable",
    "extra-menu",
    "im-module",
    "indent",
    "input-hints",
    "input-purpose",
    "justification",
    "left-margin",
    "monospace",
    "overwrite",
    "pixels-above-lines",
    "pixels-below-lines",
    "pixels-inside-wrap",
    "right-margin",
    "tabs",
    "top-margin",
    "wrap-mode"
   ]
  },
  "Gtk.ToggleButton": {
   "parent": "Gtk.Button",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Actionable",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "active",
    "group"
   ]
  },
  "Gtk.Tooltip": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.TreeExpander": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child",
    "hide-expander",
    "indent-for-depth",
    "indent-for-icon",
    "item",
    "list-row"
   ]
  },
  "Gtk.TreeListModel": {
   "parent": "GObject.Object",
   "implements": [
    "Gio.ListModel"
   ],
   "properties": [
    "autoexpand",
    "item-type",
    "model",
    "n-items",
    "passthrough"
   ]
  },
  "Gtk.TreeListRow": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "children",
    "depth",
    "expandable",
    "expanded",
    "item"
   ]
  },
  "Gtk.TreeListRowSorter": {
   "parent": "Gtk.Sorter",
   "implements": [],
   "properties": [
    "sorter"
   ]
  },
  "Gtk.TreeModelFilter": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.TreeDragSource",
    "Gtk.TreeModel"
   ],
   "properties": [
    "child-model",
    "virtual-root"
   ]
  },
  "Gtk.TreeModelSort": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.TreeDragSource",
    "Gtk.TreeModel",
    "Gtk.TreeSortable"
   ],
   "properties": [
    "model"
   ]
  },
  "Gtk.TreeSelection": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "mode"
   ]
  },
  "Gtk.TreeStore": {
   "parent": "GObject.Object",
   "implements": [
    "Gtk.Buildable",
    "Gtk.TreeDragDest",
    "Gtk.TreeDragSource",
    "Gtk.TreeModel",
    "Gtk.TreeSortable"
   ],
   "properties": []
  },
  "Gtk.TreeView": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Scrollable"
   ],
   "properties": [
    "activate-on-single-click",
    "enable-grid-lines",
    "enable-search",
    "enable-tree-lines",
    "expander-column",
    "fixed-height-mode",
    "headers-clickable",
    "headers-visible",
    "hover-expand",
    "hover-selection",
    "level-indentation",
    "model",
    "reorderable",
    "rubber-banding",
    "search-column",
    "show-expanders",
    "tooltip-column"
   ]
  },
  "Gtk.TreeViewColumn": {
   "parent": "GObject.InitiallyUnowned",
   "implements": [
    "Gtk.Buildable",
    "Gtk.CellLayout"
   ],
   "properties": [
    "alignment",
    "cell-area",
    "clickable",
    "expand",
    "fixed-width",
    "max-width",
    "min-width",
    "reorderable",
    "resizable",
    "sizing",
    "sort-column-id",
    "sort-indicator",
    "sort-order",
    "spacing",
    "title",
    "visible",
    "widget",
    "width",
    "x-offset"
   ]
  },
  "Gtk.UriLauncher": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": [
    "uri"
   ]
  },
  "Gtk.Video": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "autoplay",
    "file",
    "graphics-offload",
    "loop",
    "media-stream"
   ]
  },
  "Gtk.Viewport": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Scrollable"
   ],
   "properties": [
    "child",
    "scroll-to-focus"
   ]
  },
  "Gtk.VolumeButton": {
   "parent": "Gtk.ScaleButton",
   "implements": [
    "Gtk.Accessible",
    "Gtk.AccessibleRange",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Orientable"
   ],
   "properties": [
    "use-symbolic"
   ]
  },
  "Gtk.Widget": {
   "parent": "GObject.InitiallyUnowned",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "can-focus",
    "can-target",
    "css-classes",
    "css-name",
    "cursor",
    "focus-on-click",
    "focusable",
    "halign",
    "has-default",
    "has-focus",
    "has-tooltip",
    "height-request",
    "hexpand",
    "hexpand-set",
    "layout-manager",
    "limit-events",
    "margin-bottom",
    "margin-end",
    "margin-start",
    "margin-top",
    "name",
    "opacity",
    "overflow",
    "parent",
    "receives-default",
    "root",
    "scale-factor",
    "sensitive",
    "tooltip-markup",
    "tooltip-text",
    "valign",
    "vexpand",
    "vexpand-set",
    "visible",
    "width-request"
   ]
  },
  "Gtk.WidgetPaintable": {
   "parent": "GObject.Object",
   "implements": [
    "Gdk.Paintable"
   ],
   "properties": [
    "widget"
   ]
  },
  "Gtk.Window": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget",
    "Gtk.Native",
    "Gtk.Root",
    "Gtk.ShortcutManager"
   ],
   "properties": [
    "application",
    "child",
    "decorated",
    "default-height",
    "default-widget",
    "default-width",
    "deletable",
    "destroy-with-parent",
    "display",
    "focus-visible",
    "focus-widget",
    "fullscreened",
    "gravity",
    "handle-menubar-accel",
    "hide-on-close",
    "icon-name",
    "is-active",
    "maximized",
    "mnemonics-visible",
    "modal",
    "resizable",
    "startup-id",
    "suspended",
    "title",
    "titlebar",
    "transient-for"
   ]
  },
  "Gtk.WindowControls": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "decoration-layout",
    "empty",
    "side",
    "use-native-controls"
   ]
  },
  "Gtk.WindowGroup": {
   "parent": "GObject.Object",
   "implements": [],
   "properties": []
  },
  "Gtk.WindowHandle": {
   "parent": "Gtk.Widget",
   "implements": [
    "Gtk.Accessible",
    "Gtk.Buildable",
    "Gtk.ConstraintTarget"
   ],
   "properties": [
    "child"
   ]
  }
 },
 "interfaces": {
  "Adw.Swipeable": [],
  "GObject.TypePlugin": [],
  "Gio.Action": [
   "enabled",
   "name",
   "parameter-type",
   "state",
   "state-type"
  ],
  "Gio.ActionGroup": [],
  "Gio.ActionMap": [],
  "Gio.AppInfo": [],
  "Gio.AsyncInitable": [],
  "Gio.AsyncResult": [],
  "Gio.Converter": [],
  "Gio.DBusInterface": [],
  "Gio.DBusObject": [],
  "Gio.DBusObjectManager": [],
  "Gio.DatagramBased": [],
  "Gio.DebugController": [
   "debug-enabled"
  ],
  "Gio.Drive": [],
  "Gio.DtlsClientConnection": [
   "accepted-cas",
   "server-identity",
   "validation-flags"
  ],
  "Gio.DtlsConnection": [
   "advertised-protocols",
   "base-socket",
   "certificate",
   "ciphersuite-name",
   "database",
   "interaction",
   "negotiated-protocol",
   "peer-certificate",
   "peer-certificate-errors",
   "protocol-version",
   "rehandshake-mode",
   "require-close-notify"
  ],
  "Gio.DtlsServerConnection": [
   "authentication-mode"
  ],
  "Gio.File": [],
  "Gio.Icon": [],
  "Gio.Initable": [],
  "Gio.ListModel": [],
  "Gio.LoadableIcon": [],
  "Gio.MemoryMonitor": [],
  "Gio.Mount": [],
  "Gio.NetworkMonitor": [
   "connectivity",
   "network-available",
   "network-metered"
  ],
  "Gio.PollableInputStream": [],
  "Gio.PollableOutputStream": [],
  "Gio.PowerProfileMonitor": [
   "power-saver-enabled"
  ],
  "Gio.Proxy": [],
  "Gio.ProxyResolver": [],
  "Gio.RemoteActionGroup": [],
  "Gio.Seekable": [],
  "Gio.SocketConnectable": [],
  "Gio.TlsBackend": [],
  "Gio.TlsClientConnection": [
   "accepted-cas",
   "server-identity",
   "use-ssl3",
   "validation-flags"
  ],
  "Gio.TlsFileDatabase": [
   "anchors"
  ],
  "Gio.TlsServerConnection": [
   "authentication-mode"
  ],
  "Gio.Volume": [],
  "Gtk.Accessible": [
   "accessible-role"
  ],
  "Gtk.AccessibleRange": [],
  "Gtk.AccessibleText": [],
  "Gtk.Actionable": [
   "action-name",
   "action-target"
  ],
  "Gtk.AppChooser": [
   "content-type"
  ],
  "Gtk.Buildable": [],
  "Gtk.BuilderScope": [],
  "Gtk.CellEditable": [
   "editing-canceled"
  ],
  "Gtk.CellLayout": [],
  "Gtk.ColorChooser": [
   "rgba",
   "use-alpha"
  ],
  "Gtk.ConstraintTarget": [],
  "Gtk.Editable": [
   "cursor-position",
   "editable",
   "enable-undo",
   "max-width-chars",
   "selection-bound",
   "text",
   "width-chars",
   "xalign"
  ],
  "Gtk.FileChooser": [
   "action",
   "create-folders",
   "filter",
   "filters",
   "select-multiple",
   "shortcut-folders"
  ],
  "Gtk.FontChooser": [
   "font",
   "font-desc",
   "font-features",
   "language",
   "level",
   "preview-text",
   "show-preview-entry"
  ],
  "Gtk.Native": [],
  "Gtk.Orientable": [
   "orientation"
  ],
  "Gtk.PrintOperationPreview": [],
  "Gtk.Root": [],
  "Gtk.Scrollable": [
   "hadjustment",
   "hscroll-policy",
   "vadjustment",
   "vscroll-policy"
  ],
  "Gtk.SectionModel": [],
  "Gtk.SelectionModel": [],
  "Gtk.ShortcutManager": [],
  "Gtk.StyleProvider": [],
  "Gtk.SymbolicPaintable": [],
  "Gtk.TreeDragDest": [],
  "Gtk.TreeDragSource": [],
  "Gtk.TreeModel": [],
  "Gtk.TreeSortable": []
 }
};
