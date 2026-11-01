import { useEffect, useId, useRef, useState } from "react";
import { CHRONOLOGIES } from "../data/chronologies";
import { useStore, type Theme } from "../state/store";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** One setting as a row of choices, one of them on. */
function Choice<T extends string>({ title, options, value, onChange, note }: {
  title: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; note?: string;
}) {
  const id = useId();
  return (
    <section>
      <p id={id} className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{title}</p>
      <div role="radiogroup" aria-labelledby={id} className="flex h-8 rounded-lg border border-line bg-paper-2 p-0.5 text-sm">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded-md whitespace-nowrap transition-colors ${value === o.id ? "bg-accent text-paper" : "text-ink-muted hover:text-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {note && <p className="mt-1.5 text-xs leading-snug text-ink-muted">{note}</p>}
    </section>
  );
}

/** The gear at the right of the header: a small menu of display settings, remembered per browser. */
export default function SettingsMenu() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const eraStyle = useStore((s) => s.eraStyle);
  const setEraStyle = useStore((s) => s.setEraStyle);
  const chron = useStore((s) => s.chronologyId);
  const setChronology = useStore((s) => s.setChronology);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a press outside the menu, or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    // Escape closes just this menu, not the details panel under it (it listens later, unless stopped here).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const current = CHRONOLOGIES.find((c) => c.id === chron);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Settings"
        className={`flex size-8 items-center justify-center rounded-lg border border-line ${
          open ? "bg-ink text-paper" : "bg-paper text-ink-muted hover:text-ink"
        }`}
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18M4.3 4.3l1.6 1.6M14.1 14.1l1.6 1.6M4.3 15.7l1.6-1.6M14.1 5.9l1.6-1.6" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-1.5 w-72 space-y-4 rounded-xl border border-line bg-paper p-3 shadow-2xl">
          <Choice title="Theme" options={THEMES} value={theme} onChange={setTheme} />
          <Choice
            title="Years"
            options={[{ id: "BC", label: "BC / AD" }, { id: "BCE", label: "BCE / CE" }]}
            value={eraStyle}
            onChange={setEraStyle}
          />
          <Choice
            title="Date of the Exodus"
            options={[{ id: "early", label: "Early, c. 1446 BC" }, { id: "late", label: "Late, c. 1260 BC" }]}
            value={chron}
            onChange={setChronology}
            note={`${current?.summary ?? ""} Moves every date from Creation to Deborah, the patriarchs included; from Gideon on, both agree.`}
          />
        </div>
      )}
    </div>
  );
}
