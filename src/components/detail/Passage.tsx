import { useEffect, useState } from "react";
import type { ScriptureRef } from "../../data/schema";
import { loadBook, refBookId, versesOf, type Verse } from "../../lib/bible";
import { formatRef, refUrl } from "../../lib/scripture";
import { useStore } from "../../state/store";
import { smallCaps } from "../ScriptureText";

/** Passages longer than this many verses start cut short, with "Read more". */
const SHORT_VERSES = 6;

/** A Scripture reference that opens its text, in the Berean Standard Bible, right below it. */
export function Passage({ scripture }: { scripture: ScriptureRef }) {
  const [open, setOpen] = useState(false);
  const label = formatRef(scripture);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="group flex items-center gap-1.5 text-left text-sm text-accent"
      >
        <svg aria-hidden viewBox="0 0 12 12" className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>
          <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="underline decoration-accent/40 underline-offset-2 group-hover:decoration-accent">{label}</span>
      </button>
      {open && <PassageText scripture={scripture} />}
    </div>
  );
}

type Loaded = { verses: Verse[] } | { error: true } | undefined;

function PassageText({ scripture }: { scripture: ScriptureRef }) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [full, setFull] = useState(false);
  const redLetters = useStore((s) => s.redLetters);
  useEffect(() => {
    const id = refBookId(scripture);
    if (!id) return setLoaded({ error: true });
    let live = true;
    loadBook(id).then(
      (book) => live && setLoaded({ verses: versesOf(book, scripture) }),
      () => live && setLoaded({ error: true }),
    );
    return () => { live = false; };
  }, [scripture]);

  const gateway = (
    <a href={refUrl(scripture)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent">
      View on Bible Gateway
      <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
      </svg>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  if (!loaded) return <p className="mt-1.5 ml-4.5 text-sm text-ink-muted">Loading…</p>;
  if ("error" in loaded) {
    return (
      <p className="mt-1.5 ml-4.5 text-sm text-ink-muted">
        The text couldn’t be loaded. {gateway}
      </p>
    );
  }

  const { verses } = loaded;
  const long = verses.length > SHORT_VERSES;
  const shown = long && !full ? verses.slice(0, SHORT_VERSES) : verses;
  // A passage over more than one chapter marks where each begins.
  const chapters = verses.length > 0 && verses[0].chapter !== verses[verses.length - 1].chapter;
  return (
    <div className="mt-1.5 ml-4.5 border-l-2 border-line pl-3">
      <p className="font-serif text-[15px] leading-relaxed">
        {shown.map((v, i) => {
          const newChapter = chapters && (i === 0 || shown[i - 1].chapter !== v.chapter);
          return (
            <span key={`${v.chapter}:${v.verse}`}>
              {newChapter && (
                <>
                  {i > 0 && <><br /><br /></>}
                  <span className="mr-1 font-sans text-lg font-semibold text-ink-muted">{v.chapter}</span>
                </>
              )}
              {!(newChapter && v.verse === 1) && (
                <sup className="mr-0.5 font-sans text-[10px] font-medium text-ink-muted">{v.verse}</sup>
              )}
              {v.parts.map((p, j) => (
                <span key={j} className={p.jesus && redLetters ? "text-jesus" : undefined}>{smallCaps(p.text)}</span>
              ))}{" "}
            </span>
          );
        })}
        {long && !full && "…"}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
        {long ? (
          <button onClick={() => setFull(!full)} className="text-sm text-accent hover:underline">
            {full ? "Show less" : `Read more (${verses.length - SHORT_VERSES} more verses)`}
          </button>
        ) : <span />}
        <span className="text-xs text-ink-muted">Berean Standard Bible · {gateway}</span>
      </div>
    </div>
  );
}
