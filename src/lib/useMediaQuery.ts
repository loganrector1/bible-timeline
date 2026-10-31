import { useSyncExternalStore } from "react";
import { useStore } from "../state/store";

/** Whether a CSS media query currently matches, updating when it changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Whether the page is dark: the theme chosen in Settings, or else the OS setting. */
export function useIsDark(): boolean {
  const theme = useStore((s) => s.theme);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  return theme === "system" ? prefersDark : theme === "dark";
}

/** Below Tailwind's `md` breakpoint, where panels become bottom sheets. */
export const useIsPhone = () => useMediaQuery("(max-width: 767px)");
