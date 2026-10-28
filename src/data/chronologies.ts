// Which chronology is the default is still an open question (see key_features.md).
// Every dated entity stores its dates keyed by chronology id; any chronology
// without its own entry falls back to the default.

export const CHRONOLOGIES = [
  {
    id: "early",
    name: "Early Exodus",
    summary: "Exodus c. 1446 BC, based on 1 Kings 6:1 (480 years before Solomon's temple).",
  },
  {
    id: "late",
    name: "Late Exodus",
    summary: "Exodus c. 1260 BC, during the reign of Rameses II.",
  },
] as const;

export type ChronologyId = (typeof CHRONOLOGIES)[number]["id"];

export const DEFAULT_CHRONOLOGY: ChronologyId = "early";
