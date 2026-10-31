import type { Map as MapLibreMap } from "maplibre-gl";

export const ARROW_IMAGE = "journey-arrow";
/** An invisible image, for symbols that only take up room so labels keep clear (the route). */
export const BLANK_IMAGE = "blank";

/**
 * A white chevron with a dark edge, pointing along +x (the line's direction), which
 * reads on the journey line in both light and dark themes. Images are dropped when the
 * style reloads (e.g. a light/dark switch), so this is safe to call repeatedly. Adds the
 * blank image too.
 */
export function addArrowImage(map: MapLibreMap) {
  if (!map.hasImage(BLANK_IMAGE)) map.addImage(BLANK_IMAGE, { width: 1, height: 1, data: new Uint8Array(4) });
  if (map.hasImage(ARROW_IMAGE)) return;
  const size = 40;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(14, 9);
  ctx.lineTo(27, 20);
  ctx.lineTo(14, 31);
  ctx.strokeStyle = "rgba(40, 25, 15, 0.75)";
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.stroke();
  map.addImage(ARROW_IMAGE, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
}
