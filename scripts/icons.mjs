// Renders the app's icons to the PNG and ICO files phones, installed apps and old browsers need, in Edge.
//
//   node scripts/icons.mjs
//
// public/icon.svg (the book on its tile) makes the home-screen icons. apple-touch-icon.png and
// icon-maskable-512.png fill the square (iOS and Android round the corners themselves); the maskable
// one also shrinks the book into the middle 80%, the part every mask keeps. public/favicon.svg (the
// book alone) makes favicon.ico for browsers without SVG favicons, in one tone that holds at least
// 3:1 against light and dark tab bars alike, since an ICO can't follow the theme.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const tile = readFileSync("public/icon.svg", "utf8");
const square = tile.replace(/ rx="\d+"/, "");
const maskable = square.replace("<g>", '<g transform="translate(32 32) scale(0.8) translate(-32 -32)">');
const bare = readFileSync("public/favicon.svg", "utf8").replace(/<style>.*<\/style>/, "").replace('class="book"', 'fill="#c4603a"');

const browser = await chromium.launch({ channel: "msedge" });
async function render(source, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const sized = source.replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setContent(`<body style="margin:0;background:transparent">${sized}</body>`);
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
}

writeFileSync("public/icon-192.png", await render(tile, 192));
writeFileSync("public/icon-512.png", await render(tile, 512));
writeFileSync("public/icon-maskable-512.png", await render(maskable, 512));
writeFileSync("public/apple-touch-icon.png", await render(square, 180));

// An ICO holding PNGs (every browser since IE Vista reads them): a 6-byte header, a 16-byte entry
// per image, then the images.
const pngs = [await render(bare, 16), await render(bare, 32), await render(bare, 48)];
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(sizes[i], at);
  header.writeUInt8(sizes[i], at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
writeFileSync("public/favicon.ico", Buffer.concat([header, ...pngs]));
await browser.close();
