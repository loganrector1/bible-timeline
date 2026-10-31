import { useEffect, useRef, useState } from "react";
import { useStore, type Theme } from "../state/store";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** The gear at the right of the header: a small menu of display settings, remembered per browser. */
export default function SettingsMenu() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a press outside the menu, or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        <div className="absolute top-full right-0 z-40 mt-1.5 w-56 rounded-xl border border-line bg-paper p-3 shadow-2xl">
          <p id="settings-theme" className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Theme</p>
          <div role="radiogroup" aria-labelledby="settings-theme" className="flex h-8 rounded-lg border border-line bg-paper-2 p-0.5 text-sm">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 rounded-md transition-colors ${theme === t.id ? "bg-accent text-paper" : "text-ink-muted hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
