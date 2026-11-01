// Screenshots the running dev server (npm run dev) in Edge, for checking UI changes.
//
//   node scripts/shot.mjs <out.png> [width=1280] [height=800] [actions JSON] [light|dark]
//
// Actions run in order; each may set "wait" (ms, default 300):
//   {"mode": "Timeline"|"Both"|"Map"}   switch view
//   {"select": "The Exodus"}            pick an entity via Browse (moves time like a click)
//   {"zoomIn": 4}                       press the timeline's + button n times
//   {"click": css} {"dispatch": css} {"hover": css} {"key": "Escape"} {"type": text}
//   {"wheel": [x, y, dy, ctrl?]} {"drag": [x1, y1, x2, y2]} {"move": [x, y]} {"tap": [x, y]} (phone widths)
//   {"eval": js}                        logs the JSON result
// Env: CLIP="x,y,w,h" crops; ONBOARD=1 keeps the first-run hint; QUERY="?event=exodus" opens a link.
// Don't import app modules from "eval": that loads a second copy of the store.
import { chromium } from "playwright-core";

const [, , out, width = "1280", height = "800", actionsJson = "[]", scheme = "light"] = process.argv;
if (!out) throw new Error("usage: node scripts/shot.mjs <out.png> [width] [height] [actions] [light|dark]");
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: +width, height: +height }, colorScheme: scheme, hasTouch: +width < 700 });
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
if (!process.env.ONBOARD) await page.addInitScript(() => localStorage.setItem("bible-timeline:onboarded", "1"));
await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:5173" });
await page.goto(`http://localhost:5173/${process.env.QUERY ?? ""}`);
await page.waitForTimeout(1500);

for (const a of JSON.parse(actionsJson)) {
  if (a.mode) await page.locator(`button:has-text("${a.mode}")`).first().click();
  if (a.select) {
    await page.locator('button:has-text("Browse")').first().click();
    await page.keyboard.type(a.select);
    // Not the "Filter: show only …" suggestion rows, which can name the same thing.
    await page.locator(`[role=dialog] button:has-text("${a.select}"), aside button:has-text("${a.select}"):not(:has-text("Filter:"))`).first().click();
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
  }
  for (let i = 0; i < (a.zoomIn ?? 0); i++) {
    await page.locator('button[aria-label="Zoom in"]:not(.maplibregl-ctrl-zoom-in)').click();
    await page.waitForTimeout(120);
  }
  if (a.click) await page.locator(a.click).first().click({ timeout: 5000 });
  if (a.dispatch) await page.locator(a.dispatch).first().dispatchEvent("click");
  if (a.hover) await page.locator(a.hover).first().hover({ force: true });
  if (a.key) await page.keyboard.press(a.key);
  if (a.type) await page.keyboard.type(a.type);
  if (a.move) await page.mouse.move(a.move[0], a.move[1]);
  if (a.tap) await page.touchscreen.tap(a.tap[0], a.tap[1]);
  if (a.wheel) {
    const [x, y, dy, ctrl] = a.wheel;
    await page.mouse.move(x, y);
    if (ctrl) await page.keyboard.down("Control");
    await page.mouse.wheel(0, dy);
    if (ctrl) await page.keyboard.up("Control");
  }
  if (a.drag) {
    const [x1, y1, x2, y2] = a.drag;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.mouse.up();
  }
  if (a.eval) console.log(JSON.stringify(await page.evaluate(a.eval)));
  await page.waitForTimeout(a.wait ?? 300);
}

const clip = process.env.CLIP?.split(",").map(Number);
await page.screenshot({ path: out, ...(clip ? { clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } } : {}) });
if (logs.length) console.log(logs.join("\n"));
await browser.close();
