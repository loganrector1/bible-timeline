import type { PointerEvent } from "react";
import { datesFor, empiresById, erasById, eventsById, peopleById, type EntityRef } from "../../data";
import { formatDateSpec } from "../../lib/dates";
import { eventKind, personDatesText } from "../../lib/entities";
import { useStore } from "../../state/store";

export type TimelineHover = { ref: EntityRef; clientX: number; clientY: number };
export type OnHover = (h: TimelineHover | null) => void;

/** Pointer handlers that report hovering over an item. Touch and drags are ignored. */
export function hoverProps(ref: EntityRef, onHover: OnHover) {
  return {
    onPointerMove: (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.buttons) return;
      onHover({ ref, clientX: e.clientX, clientY: e.clientY });
    },
    onPointerLeave: () => onHover(null),
  };
}

/** A small card next to the pointer naming the hovered item and its dates. */
export function HoverCard({ hover, container }: { hover: TimelineHover; container: HTMLElement }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const { ref } = hover;

  let title = "";
  let kicker = "";
  let dates = "";
  if (ref.kind === "event") {
    const ev = eventsById.get(ref.id)!;
    const spec = datesFor(ev, chron);
    title = ev.title;
    kicker = eventKind(ev);
    dates = spec ? formatDateSpec(spec, eraStyle) : "";
  } else if (ref.kind === "person") {
    const p = peopleById.get(ref.id)!;
    title = p.name;
    kicker = p.roles.join(", ");
    dates = personDatesText(p, chron, eraStyle) ?? "";
  } else if (ref.kind === "empire") {
    const empire = empiresById.get(ref.id)!;
    const spec = datesFor(empire, chron);
    title = empire.name;
    kicker = "Empire";
    dates = spec ? formatDateSpec(spec, eraStyle) : "";
  } else if (ref.kind === "era") {
    const era = erasById.get(ref.id)!;
    const spec = datesFor(era, chron);
    title = era.name;
    kicker = "Era";
    dates = spec ? formatDateSpec(spec, eraStyle) : "";
  }

  const rect = container.getBoundingClientRect();
  const x = hover.clientX - rect.left;
  const y = hover.clientY - rect.top;
  const flip = x > rect.width - 240; // Keep the card inside the timeline.

  return (
    <div
      className="pointer-events-none absolute z-20 max-w-60 rounded-lg border border-line bg-paper px-3 py-2 text-sm shadow-lg"
      style={{ top: y + 12, ...(flip ? { right: rect.width - x + 12 } : { left: x + 14 }) }}
    >
      {kicker && <div className="text-[10px] font-semibold tracking-wider text-ink-muted uppercase">{kicker}</div>}
      <div className="font-semibold">{title}</div>
      {dates && <div className="text-xs text-ink-muted">{dates}</div>}
    </div>
  );
}
