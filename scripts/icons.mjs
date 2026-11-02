// Renders public/icon.svg to the PNG icons phones and installed apps need, in Edge.
//
//   node scripts/icons.mjs
//
// apple-touch-icon.png and icon-maskable-512.png fill the square (iOS and Android round the corners
// themselves); the maskable one also shrinks the book into the middle 80%, the part every mask keeps.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const svg = readFileSync("public/icon.svg", "utf8");
const square = svg.replace(/ rx="\d+"/, "");
const maskable = square.replace("<g>", '<g transform="translate(32 32) scale(0.8) translate(-32 -32)">');
const icons = [
  ["public/icon-192.png", svg, 192],
  ["public/icon-512.png", svg, 512],
  ["public/icon-maskable-512.png", maskable, 512],
  ["public/apple-touch-icon.png", square, 180],
];

const browser = await chromium.launch({ channel: "msedge" });
for (const [out, source, size] of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const sized = source.replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setContent(`<body style="margin:0;background:transparent">${sized}</body>`);
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
}
await browser.close();
