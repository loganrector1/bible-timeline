import { useState } from "react";

const KEY = "bible-timeline:onboarded";

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** A one-time card explaining the timeline, the map and the time cursor. */
export default function Onboarding() {
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Private browsing or blocked storage: the card will simply show again next time.
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/30 p-4" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-2xl"
      >
        <h2 id="onboarding-title" className="font-serif text-2xl font-semibold">Welcome</h2>
        <p className="mt-2 text-ink-muted">Explore the biblical story through time and place.</p>
        <ul className="mt-4 space-y-3 text-[15px] leading-snug">
          <li>
            <strong>Scroll or drag the timeline</strong> to move through time. Earliest is at the top.
            Ctrl + scroll, pinch, or the +/− buttons zoom from centuries down to days.
          </li>
          <li>
            <strong>The line across the middle of the timeline is the current moment.</strong> The map shows what was happening then,
            and both views always stay in step.
          </li>
          <li>
            <strong>Click any event, person, place or era</strong> for details, Scripture and the route it
            traveled. Press ▶ under the map to play history forward.
          </li>
          <li>
            <strong>Not sure where to start?</strong> Open Browse and pick a guided tour, from Creation to
            Paul's journeys.
          </li>
        </ul>
        <button
          autoFocus
          onClick={dismiss}
          className="mt-6 w-full rounded-lg bg-accent py-2 font-semibold text-paper hover:opacity-90"
        >
          Start exploring
        </button>
      </div>
    </div>
  );
}
