import { toursById } from "../data";
import { useStore } from "../state/store";

/**
 * The guided tour, at the top of the details panel: the step's narration with Back and Next
 * while its event is selected, or a way back to it once the reader has wandered off.
 * Its buttons are marked `data-sheet-close` so the phone sheet doesn't treat taps as drags.
 */
export default function TourBox({ clamp }: { clamp: boolean }) {
  const tour = useStore((s) => s.tour);
  const selection = useStore((s) => s.selection);
  const startTour = useStore((s) => s.startTour);
  const endTour = useStore((s) => s.endTour);
  const t = tour && toursById.get(tour.id);
  if (!tour || !t) return null;
  const step = t.steps[tour.step];
  const onStep = selection?.kind === "event" && selection.id === step.event;
  const last = tour.step === t.steps.length - 1;
  const btn = "rounded-md border border-accent/40 px-2 py-0.5 text-sm hover:bg-accent hover:text-paper disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit";

  if (!onStep) {
    return (
      <div className="mx-5 mt-2 flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm">
        <span className="min-w-0 truncate text-ink-muted">
          Tour paused: <span className="text-ink">{t.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button data-sheet-close onClick={() => startTour(t.id, tour.step)} className={btn}>Resume</button>
          <button data-sheet-close onClick={endTour} aria-label="End tour" className="rounded p-1 text-ink-muted hover:text-ink">✕</button>
        </span>
      </div>
    );
  }

  return (
    <section aria-label={`Tour: ${t.title}`} className="mx-5 mt-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-baseline gap-1.5 text-[11px] font-semibold tracking-wider text-accent uppercase">
          <span className="min-w-0 truncate">Tour · {t.title}</span>
          <span className="shrink-0 font-normal text-ink-muted normal-case">{tour.step + 1} of {t.steps.length}</span>
        </p>
        <span className="flex shrink-0 items-center gap-1">
          <button data-sheet-close onClick={() => startTour(t.id, tour.step - 1)} disabled={tour.step === 0} aria-label="Previous step" className={btn}>‹ Back</button>
          {last ? (
            <button data-sheet-close onClick={endTour} className={btn}>Finish</button>
          ) : (
            <button data-sheet-close onClick={() => startTour(t.id, tour.step + 1)} aria-label="Next step" className={btn}>Next ›</button>
          )}
          <button data-sheet-close onClick={endTour} aria-label="End tour" className="rounded p-1 text-ink-muted hover:text-ink">✕</button>
        </span>
      </div>
      <p className={`mt-1 text-[15px] leading-snug ${clamp ? "line-clamp-2" : ""}`}>{step.text}</p>
    </section>
  );
}
