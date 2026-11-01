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
        onClick={() => {
          // On phones Browse covers the screen, so a menu opened over it closes it.
          if (!open && matchMedia("(max-width: 767px)").matches) useStore.getState().setBrowseOpen(false);
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Settings"
        className={`flex size-8 items-center justify-center rounded-lg border border-line ${
          open ? "bg-ink text-paper" : "bg-paper text-ink-muted hover:text-ink"
        }`}
      >
        {/* A gear (Heroicons' cog-6-tooth, MIT), not rays, which read as the theme's sun. */}
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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
