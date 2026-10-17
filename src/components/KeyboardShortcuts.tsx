import React, { useCallback, useEffect, useRef } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type AdwShortcutsDialogElement = HTMLElement & {
  present: () => void;
  close: () => void;
  forceClose: () => void;
  open: boolean;
};

const SHORTCUT_GROUPS = [
  {
    title: "Editing",
    items: [
      { label: "Undo", accelerator: "<Control>Z" },
      { label: "Redo", accelerator: "<Control><Shift>Z" },
      { label: "Delete selected element", accelerator: "Delete" },
      { label: "Move element up", accelerator: "<Control>Up" },
      { label: "Move element down", accelerator: "<Control>Down" },
      { label: "Deselect", accelerator: "Escape" },
    ],
  },
  {
    title: "View",
    items: [
      { label: "Zoom in", accelerator: "<Control>equal" },
      { label: "Zoom out", accelerator: "<Control>minus" },
      { label: "Zoom to 100%", accelerator: "<Control>0" },
      { label: "Pan canvas", accelerator: "space", subtitle: "Drag" },
    ],
  },
  {
    title: "Quick Add",
    items: [
      { label: "Add button", accelerator: "b" },
      { label: "Add label", accelerator: "t" },
      { label: "Add list box", accelerator: "l" },
      { label: "New screen", accelerator: "<Control>N" },
    ],
  },
  {
    title: "Interface",
    items: [
      { label: "Toggle Layers Panel", accelerator: "<Control>bracketleft" },
      { label: "Toggle Properties Panel", accelerator: "<Control>bracketright" },
      { label: "Toggle Screen Flows", accelerator: "<Control>semicolon" },
      { label: "Toggle Diagnostics", accelerator: "<Control>apostrophe" },
      { label: "Toggle Preview Mode", accelerator: "<Control>slash" },
      { label: "Show this help", accelerator: "<Control>question" },
    ],
  },
];

export const KeyboardShortcuts: React.FC<Props> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<AdwShortcutsDialogElement | null>(null);

  // The shortcuts dialog is a flat header bar over a scroller, so the shade
  // under the header is Adwaita's top undershoot: it is drawn only once the
  // list has been scrolled away from the top, not while it is at the start.
  const syncScrolled = useCallback((dialog: AdwShortcutsDialogElement) => {
    const content = dialog.querySelector<HTMLElement>(".adw-dialog-content");
    dialog.toggleAttribute("data-scrolled", !!content && content.scrollTop > 0);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.present();
      syncScrolled(dialog);
    } else {
      dialog.forceClose();
    }
  }, [isOpen, syncScrolled]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const content = dialog?.querySelector<HTMLElement>(".adw-dialog-content");
    if (!dialog || !content) return;
    const handleScroll = () => syncScrolled(dialog);
    content.addEventListener("scroll", handleScroll, { passive: true });
    return () => content.removeEventListener("scroll", handleScroll);
  }, [syncScrolled]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClosed = () => onClose();
    dialog.addEventListener("closed", handleClosed);
    return () => dialog.removeEventListener("closed", handleClosed);
  }, [onClose]);

  return (
    <adw-shortcuts-dialog
      ref={dialogRef as React.Ref<HTMLElement>}
      title="Keyboard Shortcuts"
      data-testid="shortcuts-overlay"
      content-width={520}
    >
      {SHORTCUT_GROUPS.map((group) => (
        <React.Fragment key={group.title}>
          <adw-shortcuts-section title={group.title}>
            {group.items.map((item) => (
              <React.Fragment key={item.label}>
                <adw-shortcuts-item
                  title={item.label}
                  accelerator={item.accelerator}
                  subtitle={"subtitle" in item ? item.subtitle : undefined}
                />
              </React.Fragment>
            ))}
          </adw-shortcuts-section>
        </React.Fragment>
      ))}
    </adw-shortcuts-dialog>
  );
};
