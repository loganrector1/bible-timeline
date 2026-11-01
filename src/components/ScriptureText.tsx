import { Fragment, type ReactNode } from "react";

// A word in capitals ("LORD", "I AM WHO I AM", "TO AN UNKNOWN GOD"), as the BSB writes them.
const CAPS = /\b([A-Z])([A-Z]+)\b/g;

/**
 * Scripture's words in capitals set in small capitals, as printed Bibles do: "LORD" reads as
 * "Lord" with a small-capital "ORD", not as shouting.
 */
export function smallCaps(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(CAPS)) {
    out.push(text.slice(last, m.index));
    out.push(<span key={m.index} className="[font-variant-caps:small-caps]">{m[1]}{m[2].toLowerCase()}</span>);
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

/**
 * Prose that may quote Scripture: only the quoted parts get small capitals, so "AD 30" and
 * "BC" outside them stay as they are.
 */
export function Prose({ text }: { text: string }) {
  if (!/"[^"]*[A-Z]{2}/.test(text)) return text;
  return text.split(/("[^"]*")/).map((part, i) => (
    <Fragment key={i}>{i % 2 ? smallCaps(part) : part}</Fragment>
  ));
}
