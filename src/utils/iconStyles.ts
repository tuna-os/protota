import { toDataUri } from "@gjsify/adwaita-icons/utils";

/**
 * Shared mask-icon style for Adwaita symbolic icons.
 * Use this for toolbar buttons, menu items, and header bar controls.
 *
 * Sized exactly like the compiled skin's `.adw-icon` (fixed 16px tile,
 * no-repeat, centered) — `mask-size: contain` alone depends on the SVG's
 * intrinsic dimensions and tiles by default, which renders non-16×16 masks
 * tiny and repeated.
 */
export const iconStyle = (svg: string): React.CSSProperties => ({
  display: "inline-block",
  width: "16px",
  height: "16px",
  flexShrink: 0,
  maskImage: toDataUri(svg),
  WebkitMaskImage: toDataUri(svg),
  maskSize: "16px",
  WebkitMaskSize: "16px",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
  backgroundColor: "currentColor",
});
