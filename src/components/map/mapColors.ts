// MapLibre paints need concrete colors, so these mirror the theme tokens in index.css.
export type MapColors = {
  accent: string;
  ink: string;
  muted: string;
  halo: string;
};

export const LIGHT: MapColors = { accent: "#9a3b1b", ink: "#3a2f24", muted: "#8a7a66", halo: "#faf6ee" };
export const DARK: MapColors = { accent: "#e08a5f", ink: "#efe8dc", muted: "#a89d8e", halo: "#1c1915" };
