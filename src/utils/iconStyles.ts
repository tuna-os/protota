import { toDataUri } from "@gjsify/adwaita-icons/utils";

/**
 * Shared mask-icon style for Adwaita symbolic icons.
 * Use this for toolbar buttons, menu items, and header bar controls.
 */
export const iconStyle = (svg: string): React.CSSProperties => ({
  display: "inline-block",
  width: "16px",
  height: "16px",
  maskImage: toDataUri(svg),
  WebkitMaskImage: toDataUri(svg),
  maskSize: "contain",
  WebkitMaskSize: "contain",
  backgroundColor: "currentColor",
});
