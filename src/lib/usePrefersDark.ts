import { useSyncExternalStore } from "react";

const query = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
