import { registerSW } from "virtual:pwa-register";

/**
 * Registers the service worker. A new version waits until the page is hidden (another tab, the
 * phone's home screen) before reloading into it, so a deploy never reloads the page mid-read; the
 * old one keeps serving its own files meanwhile, so Bible books loaded later still match. The URL
 * holds the view, so the reload comes back to the same place.
 */
export function startServiceWorker() {
  let update: ((reload?: boolean) => Promise<void>) | undefined;
  let waiting = false;
  const applyWhenHidden = () => {
    if (waiting && document.hidden) update?.(true);
  };
  update = registerSW({
    onNeedRefresh() {
      waiting = true;
      applyWhenHidden();
    },
    onRegisteredSW(_url, registration) {
      // An installed app can stay open for days: look for a new version whenever it comes back.
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) registration?.update();
      });
    },
  });
  document.addEventListener("visibilitychange", applyWhenHidden);
}
