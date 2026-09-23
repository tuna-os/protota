# GtkPopover & GtkPopoverMenu

**Package**: `gtk4`, `libadwaita-1`  
**Use**: Context popovers, info popovers, and account/profile menus attached to header bar buttons or menu buttons.

## Basic Info Popover

```xml
<object class="GtkMenuButton">
  <property name="icon-name">info-symbolic</property>
  <property name="popover">
    <object class="GtkPopover">
      <property name="child">
        <object class="GtkLabel">
          <property name="label" translatable="yes">Explanation text...</property>
          <property name="wrap">True</property>
          <property name="max-width-chars">50</property>
          <property name="margin-start">6</property>
          <property name="margin-end">6</property>
          <property name="margin-top">6</property>
          <property name="margin-bottom">6</property>
        </object>
      </property>
    </object>
  </property>
</object>
```

---

## Account Presentation within Popovers (GNOME HIG & Libadwaita)

> Consulted in [tuna-os/protota#268](https://github.com/tuna-os/protota/issues/268) — standardizing account details in popovers according to Libadwaita and GNOME HIG principles.

When apps present account status (such as a profile picture, user display name, handle or email, and account-scoped actions), legacy GTK3/GTK4 patterns often rely on hand-rolled box layouts with custom image widgets, hardcoded font sizing, or manual CSS border-radius hacks. Modern Libadwaita apps follow HIG conventions using native Libadwaita primitives (`AdwAvatar`, typography style classes, `AdwActionRow`, and `GtkPopoverMenu` custom sections).

### 1. Header Bar Trigger (Avatar Button)

The trigger in the header bar is typically a circular menu button showing the current user's avatar:

- **Widget**: `GtkMenuButton` with style classes `.flat` and `.circular`.
- **Child**: `AdwAvatar` (size 28–32px).
  - Set `show-initials: true` and bind `text` to the user's display name so initials render automatically if the profile picture has not loaded.
  - Set `tooltip-text` to `_("Account")` or the user's name.

```
Gtk.MenuButton account_btn {
  tooltip-text: _("Account");
  styles [ "flat", "circular" ]

  child: Adw.Avatar {
    size: 28;
    show-initials: true;
    text: "Jane Doe";
  };

  popover: account_popover;
}
```

### 2. Popover Header: Profile Picture, Name, and Username

Inside the popover, the account detail section should appear at the top, cleanly separated from menu actions.

#### Structure

1. **Header Container**: `GtkBox` with horizontal orientation, `spacing: 12`, and standard margin (6–12px).
2. **Profile Avatar**: `AdwAvatar` with `size: 48` (or 56):
   - Handles circular masking natively without CSS `border-radius: 50%` or `overflow: hidden` hacks.
   - Provides initials fallback via `show-initials: true` and `text`.
   - Adapts to system light/dark theme variants.
3. **Text Column**: `GtkBox` with vertical orientation, `spacing: 2`, `valign: center`, and `hexpand: true`.
   - **Display Name**: `GtkLabel` with style class `.heading` (or `.title`), `halign: start`, and `ellipsize: end`.
   - **Handle / Username / Email**: `GtkLabel` with style classes `.caption` and `.dim-label` (or `.subtitle`), `halign: start`, and `ellipsize: end`.

```
Gtk.Box profile_header {
  orientation: horizontal;
  spacing: 12;
  margin-top: 6;
  margin-bottom: 6;
  margin-start: 6;
  margin-end: 6;

  Adw.Avatar {
    size: 48;
    show-initials: true;
    text: "Jane Doe";
  }

  Gtk.Box {
    orientation: vertical;
    valign: center;
    hexpand: true;
    spacing: 2;

    Gtk.Label {
      label: "Jane Doe";
      halign: start;
      ellipsize: end;
      styles [ "heading" ]
    }

    Gtk.Label {
      label: "@janedoe";
      halign: start;
      ellipsize: end;
      styles [ "caption", "dim-label" ]
    }
  }
}
```

### 3. Integrating with `GtkPopoverMenu`

When using a menu-model-backed popover (`GtkPopoverMenu`), attach the custom profile header using the `custom` attribute:

#### Menu Model (Blueprint)
```
menu account_menu {
  section {
    item {
      custom: "profile-header";
    }
  }

  section {
    item {
      label: _("_Account Settings");
      action: "app.account-settings";
      hidden-when: "action-disabled";
    }
    item {
      label: _("_Switch Account");
      action: "app.switch-account";
      hidden-when: "action-disabled";
    }
  }

  section {
    item {
      label: _("_Sign In");
      action: "app.sign-in";
      hidden-when: "action-disabled";
    }
    item {
      label: _("_Log Out");
      action: "app.logout";
      hidden-when: "action-disabled";
    }
  }
}
```

#### Code Wiring (Python)
```python
popover = Gtk.PopoverMenu.new_from_model(account_menu)
popover.add_child(profile_header, "profile-header")
account_btn.set_popover(popover)
```

#### Code Wiring (C)
```c
GtkPopoverMenu *popover = GTK_POPOVER_MENU (gtk_popover_menu_new_from_model (account_menu));
gtk_popover_menu_add_child (popover, profile_header, "profile-header");
gtk_menu_button_set_popover (account_btn, GTK_WIDGET (popover));
```

### 4. Alternative: Boxed List / ActionRow Pattern

When the account header itself should be activatable (e.g. drilling down to profile settings) or when presenting multiple accounts in a switcher:

- Use a `GtkListBox` with the `.boxed-list` style class (or `AdwPreferencesGroup`).
- Embed an `AdwActionRow`:
  - `[prefix]`: `AdwAvatar` (size 36–40px).
  - `title`: Display Name.
  - `subtitle`: Handle or email.
  - `[suffix]`: `GtkImage` with `go-next-symbolic` (for drill-down) or `object-select-symbolic` (for current active account).
  - `activatable: true`.

```
Adw.ActionRow {
  title: "Jane Doe";
  subtitle: "@janedoe";
  activatable: true;

  [prefix]
  Adw.Avatar {
    size: 36;
    show-initials: true;
    text: "Jane Doe";
  }

  [suffix]
  Gtk.Image {
    icon-name: "go-next-symbolic";
  }
}
```

---

## Anti-Patterns & HIG Guidelines

| Don't | Do Instead |
|-------|-----------|
| Use custom `GtkImage` with CSS `border-radius: 50%` or clipping hacks | Use `AdwAvatar` with `show-initials: true` and appropriate `size` |
| Hardcode font sizes (e.g. `font-size: 14px`) or fixed colors | Use Libadwaita style classes (`.heading`, `.title`, `.subtitle`, `.caption`, `.dim-label`) |
| Embed full multi-field login / registration forms directly in a popover | Use a brief status header in the popover and open an `AdwDialog` or `AdwPreferencesDialog` for credentials |
| Mix app-wide actions with account actions | Keep account popovers scoped to user/account actions; use a separate hamburger menu for app actions |
| Exceed 1/3 of the parent window size | Keep popovers compact, lightweight, and dismissible via `Escape` |
