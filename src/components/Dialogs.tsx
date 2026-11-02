import type { ReactNode } from "react";
import { useStore } from "../state/store";

const REPO = "https://github.com/loganrector1/bible-timeline";

/** A card over the app; a click outside it, its button or Escape (in the store) closes it. */
function Card({ title, children, done }: { title: string; children: ReactNode; done: ReactNode }) {
  const setDialog = useStore((s) => s.setDialog);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/30 p-4" onClick={() => setDialog(null)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-2xl"
      >
        <h2 id="dialog-title" className="font-serif text-2xl font-semibold">{title}</h2>
        {children}
        {done}
      </div>
    </div>
  );
}

/** The first-run card explaining the timeline, the map and the time cursor. */
function Welcome() {
  const setDialog = useStore((s) => s.setDialog);
  return (
    <Card
      title="Welcome"
      done={
        <button
          autoFocus
          onClick={() => setDialog(null)}
          className="mt-6 w-full rounded-lg bg-accent py-2 font-semibold text-paper hover:opacity-90"
        >
          Start exploring
        </button>
      }
    >
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
    </Card>
  );
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  );
}

/** What the app is, whose work it stands on, and where its code is (Settings → About). */
function About() {
  const setDialog = useStore((s) => s.setDialog);
  return (
    <Card
      title="About Bible Timeline"
      done={
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setDialog("welcome")}
            className="flex-1 rounded-lg border border-line py-2 text-sm text-ink-muted hover:text-ink"
          >
            Welcome tips
          </button>
          <button
            autoFocus
            onClick={() => setDialog(null)}
            className="flex-1 rounded-lg bg-accent py-2 font-semibold text-paper hover:opacity-90"
          >
            Close
          </button>
        </div>
      }
    >
      <p className="mt-2 text-[15px] leading-snug">
        The whole Bible on a timeline and a map: when things happened, who was there, and where. Where
        scholars disagree on a date or a site, it's marked as uncertain, with a note.
      </p>
      <p className="mt-4 mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Credits</p>
      <ul className="space-y-1.5 text-sm leading-snug">
        <li>
          Scripture: the <Link href="https://bereanbible.com/">Berean Standard Bible</Link> (public domain)
        </li>
        <li>
          Places: <Link href="https://www.openbible.info/geo/">OpenBible.info</Link>'s Bible geocoding (CC BY 4.0)
        </li>
        <li>
          Empires: <Link href="https://github.com/Seshat-Global-History-Databank/cliopatria">Cliopatria</Link>, Seshat
          Global History Databank (CC BY 4.0)
        </li>
        <li>
          Map: <Link href="https://openfreemap.org/">OpenFreeMap</Link>, © OpenMapTiles, ©{" "}
          <Link href="https://www.openstreetmap.org/copyright">OpenStreetMap</Link> contributors,{" "}
          <Link href="https://www.naturalearthdata.com/">Natural Earth</Link>, and{" "}
          <Link href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</Link> on AWS
        </li>
      </ul>
      <p className="mt-4 text-sm">
        <Link href={REPO}>Source code on GitHub</Link>
      </p>
    </Card>
  );
}

export default function Dialogs() {
  const dialog = useStore((s) => s.dialog);
  if (dialog === "welcome") return <Welcome />;
  if (dialog === "about") return <About />;
  return null;
}
