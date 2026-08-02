import { useEffect, useState } from "react";

/**
 * App-wide mobile breakpoint (#99): viewports at or below 768px get the
 * compact header (icon-only Open/Export triggers) and the collapsed bottom
 * bar. Tracked via matchMedia so components that need the value in JS (not
 * just CSS) re-render on viewport changes, same as BottomBar.
 */
export function useIsMobile(breakpoint = "(max-width: 768px)"): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(breakpoint).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(breakpoint);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}
