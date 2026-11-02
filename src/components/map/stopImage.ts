import type { Map as MapLibreMap } from "maplibre-gl";

const PREFIX = "stop:";
const RATIO = 2;

/**
 * The image name for a journey stop's marker: its number(s), whether it's the stop an event
 * along the way happened at (a thicker ring), and the theme's colors. The name says
 * everything needed to draw it, so a missing image (first use, or after the style reloads)
 * can always be drawn on demand.
 */
export function stopImageName(label: string, current: boolean, fill: string, ring: string): string {
  return [PREFIX + label, current ? 1 : 0, fill, ring].join("|");
}

/**
 * A journey stop drawn as one image, disc and number together: a circle, or a pill for merged
 * stops ("4·6"). MapLibre draws all of a layer's circles before any of its text, so overlapping
 * stops drawn as circle plus text showed numbers through each other; as images, the stop on
 * top covers the one beneath.
 */
function drawStop(map: MapLibreMap, name: string) {
  const [label, current, fill, ring] = name.slice(PREFIX.length).split("|");
  const stroke = current === "1" ? 4 : 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `bold ${11 * RATIO}px "Noto Sans", system-ui, sans-serif`;
  ctx.font = font;
  const textW = ctx.measureText(label).width / RATIO;
  const h = 18 + stroke * 2;
  const w = Math.max(h, Math.ceil(textW) + 12 + stroke * 2);
  canvas.width = w * RATIO;
  canvas.height = h * RATIO;
  ctx.scale(RATIO, RATIO);
  const r = h / 2 - stroke / 2;
  ctx.beginPath();
  ctx.roundRect(stroke / 2, stroke / 2, w - stroke, h - stroke, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = stroke;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.font = `bold 11px "Noto Sans", system-ui, sans-serif`;
  ctx.fillStyle = ring;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2 + 0.5);
  map.addImage(name, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: RATIO });
}

/** Draws stop markers as the map asks for them. Call once per map. */
export function provideStopImages(map: MapLibreMap) {
  map.setMissingStyleImageResolver((id) => {
    if (id.startsWith(PREFIX) && !map.hasImage(id)) drawStop(map, id);
  });
}
