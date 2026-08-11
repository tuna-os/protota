import React, { useRef, useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const kbdStyle: React.CSSProperties = {
  background: "var(--button-bg-color, rgba(0,0,6,0.08))",
  padding: "1px 6px",
  borderRadius: "4px",
  fontSize: "11px",
  border: "1px solid var(--separator-color, rgba(0,0,6,0.12))",
};

const SHORTCUT_GROUPS = [
  {
    title: "Editing",
    items: [
      { keys: "Ctrl+Z", label: "Undo" },
      { keys: "Ctrl+Shift+Z", label: "Redo" },
      { keys: "Delete", label: "Delete selected element" },
      { keys: "Ctrl+↑", label: "Move element up" },
      { keys: "Ctrl+↓", label: "Move element down" },
      { keys: "Escape", label: "Deselect" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: "Ctrl+=", label: "Zoom in" },
      { keys: "Ctrl+-", label: "Zoom out" },
      { keys: "Ctrl+0", label: "Zoom to 100%" },
      { keys: "Space+Drag", label: "Pan canvas" },
    ],
  },
  {
    title: "Quick Add",
    items: [
      { keys: "B", label: "Add button" },
      { keys: "T", label: "Add label" },
      { keys: "L", label: "Add list box" },
      { keys: "Ctrl+N", label: "New screen" },
    ],
  },
  {
    title: "Interface",
    items: [
      { keys: "Ctrl+[", label: "Toggle Layers Panel" },
      { keys: "Ctrl+]", label: "Toggle Properties Panel" },
      { keys: "Ctrl+;", label: "Toggle Screen Flows" },
      { keys: "Ctrl+'", label: "Toggle Diagnostics" },
      { keys: "Ctrl+/", label: "Toggle Preview Mode" },
      { keys: "Ctrl+?", label: "Show this help" },
    ],
  },
];

/**
 * Keyboard Shortcuts help dialog — extracted from App.tsx (#159).
 * Renders shortcut groups inside an Adw.Dialog, matching the GNOME HIG
 * AdwShortcutsDialog pattern.
 */
export const KeyboardShortcuts: React.FC<Props> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      (el as any).present?.();
    }
  }, [isOpen]);

  // Propagate the dialog's own close event (Escape, backdrop click) to the
  // parent so the state gate in App stays in sync.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener("closed", handler);
    return () => el.removeEventListener("closed", handler);
  }, [onClose]);

  return (
    <adw-dialog
      ref={dialogRef}
      data-testid="shortcuts-overlay"
      title="Keyboard Shortcuts"
      content-width={520}
      can-close=""
    >
      <div style={{ padding: "0 24px 24px", overflow: "auto" }}>
        <p style={{ fontSize: "12px", opacity: 0.65, marginBottom: "16px" }}>
          Press <kbd style={kbdStyle}>Ctrl+?</kbd> to toggle this overlay.
        </p>
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: "16px" }}>
            <h4
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                opacity: 0.5,
                margin: "0 0 6px 0",
              }}
            >
              {group.title}
            </h4>
            {group.items.map((item) => (
              <div
                key={item.keys}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  fontSize: "13px",
                  borderBottom: "1px solid var(--separator-color, rgba(0,0,6,0.06))",
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontFamily: "Adwaita Sans", fontSize: "12px", opacity: 0.7 }}>
                  {item.keys
                    .split(" ")
                    .map((k) => (
                      <kbd key={k} style={kbdStyle}>
                        {k}
                      </kbd>
                    ))
                    .reduce((prev, curr) => (
                      <>
                        {prev} {curr}
                      </>
                    ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </adw-dialog>
  );
};
