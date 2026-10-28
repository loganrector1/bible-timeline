import { useSyncExternalStore } from "react";

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

export const usePrefersDark = () => useMediaQuery("(prefers-color-scheme: dark)");

/** Below Tailwind's `md` breakpoint, where panels become bottom sheets. */
export const useIsPhone = () => useMediaQuery("(max-width: 767px)");
