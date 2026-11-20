// 3 つのエンジンで、2 つの方式の書き出しを成功条件と突き合わせる
import { writeFile } from "node:fs/promises";
import pixelmatch from "pixelmatch";
import { chromium, firefox, webkit } from "playwright";
import { PNG } from "pngjs";
import { serve } from "./server.mjs";

const PORT = 8765;
const OUT = "/work/poc/export-image/out";
const ENGINES = { chromium, firefox, webkit };
const METHODS = ["exportForeign", "exportReplaced"];
const VIEWPORT = { width: 2000, height: 1400 };

function diffRatio(a, b) {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return { ratio: null, size: [pa.width, pa.height, pb.width, pb.height] };
  const diff = new PNG({ width: pa.width, height: pa.height });
  const count = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { includeAA: false, threshold: 0.1 });
  return { ratio: (count / (pa.width * pa.height)) * 100, count, diff: PNG.sync.write(diff) };
}

/** 1 px の範囲のどこかに一致する画素があれば同じとみなした、違う画素の割合 */
function diffRatioShift1(a, b) {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return null;
  const { width, height } = pa;
  const near = (i, j) => Math.abs(pa.data[i] - pb.data[j]) + Math.abs(pa.data[i + 1] - pb.data[j + 1]) + Math.abs(pa.data[i + 2] - pb.data[j + 2]) <= 48;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      let ok = false;
      for (let dy = -1; dy <= 1 && !ok; dy += 1) {
        for (let dx = -1; dx <= 1 && !ok; dx += 1) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          if (near(i, (yy * width + xx) * 4)) ok = true;
        }
      }
      if (!ok) count += 1;
    }
  }
  return (count / (width * height)) * 100;
}

function maxCenterDiff(a, b) {
  let max = 0;
  const missing = [];
  for (const [text, ca] of Object.entries(a)) {
    const cb = b[text];
    if (!cb) {
      missing.push(text);
      continue;
    }
    max = Math.max(max, Math.hypot(ca.x - cb.x, ca.y - cb.y));
  }
  return { max, missing };
}

function checkSvg(svg, page) {
  const external = [
    ...svg.matchAll(/(?:xlink:)?href="(?!#)[^"]*"/g),
    ...svg.matchAll(/url\((?!["']?#)[^)]*\)/g),
    ...svg.matchAll(/var\(/g),
  ].map((m) => m[0]);
  const plain = svg.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  const missingTexts = page.texts.filter((t) => !plain.includes(t.replace(/\s+/g, "")));
  const iconCount = (svg.match(/viewBox="0 0 24 24"/g) ?? []).length;
  return {
    external,
    missingTexts,
    icons: { page: page.iconCount, svg: iconCount },
    borderColor: { value: page.borderColor, found: svg.includes(page.borderColor) },
    closedGroup: { name: plain.includes("保存先"), inner: plain.includes("キャッシュ") },
  };
}

async function shotStage(page) {
  const box = await page.evaluate(() => {
    const r = document.querySelector(".mdmark-diagram-stage").getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  return page.screenshot({ clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } });
}

async function pageCenters(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".mdmark-diagram-stage");
    const { scale, rect } = window.pocExport.stageSize(stage);
    return window.pocExport.textCenters(stage, rect, scale);
  });
}

async function runEngine(name) {
  const browser = await ENGINES[name].launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/poc/export-image/index.html`);
  await page.waitForSelector(".mdmark-map .mdmark-diagram-wires", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => window.pocExport !== undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  // 揺れ: 同じページを 2 回撮る・測る
  const shotA = await shotStage(page);
  await page.waitForTimeout(300);
  const shotB = await shotStage(page);
  const jitterPixel = diffRatio(shotA, shotB).ratio;
  const centersA = await pageCenters(page);
  const centersB = await pageCenters(page);
  const jitterCenter = maxCenterDiff(centersA, centersB).max;
  await writeFile(`${OUT}/${name}-page.png`, shotA);

  const pageInfo = await page.evaluate(() => {
    const stage = document.querySelector(".mdmark-diagram-stage");
    const texts = [...stage.querySelectorAll(".mdmark-diagram-node")].map((n) => n.textContent.trim()).filter(Boolean);
    const iconCount = stage.querySelectorAll(".mdmark-diagram-node svg").length;
    const target = [...stage.querySelectorAll(".mdmark-diagram-node")].find((n) => n.textContent.includes("mount"));
    return { texts, iconCount, borderColor: getComputedStyle(target).borderTopColor };
  });

  const N = jitterPixel * 2;
  const M = Math.max(1, jitterCenter * 2);
  const results = {};
  for (const method of METHODS) {
    const out = await page.evaluate(async (m) => {
      const frame = document.querySelector(".mdmark-map");
      const t0 = performance.now();
      const { svg, width, height } = window.pocExport[m](frame);
      const t1 = performance.now();
      const png = await window.pocExport.toPng(svg, width, height);
      return { svg, width, height, png, ms: Math.round(t1 - t0) };
    }, method);
    await writeFile(`${OUT}/${name}-${method}.svg`, out.svg);
    if (out.png.ok) await writeFile(`${OUT}/${name}-${method}.png`, Buffer.from(out.png.dataUrl.split(",")[1], "base64"));

    // 書き出した SVG を単独で開いて撮る・測る
    const soloName = `${name}-${method}-solo.html`;
    await writeFile(`${OUT}/${soloName}`, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff">${out.svg}<script type="module" src="../export.js"></script></body></html>`);
    const solo = await context.newPage();
    await solo.goto(`http://localhost:${PORT}/poc/export-image/out/${soloName}`);
    await solo.waitForFunction(() => window.pocExport !== undefined);
    await solo.waitForTimeout(800);
    const soloShot = await solo.locator("body > svg").first().screenshot();
    await writeFile(`${OUT}/${name}-${method}-solo.png`, soloShot);
    const soloCenters = await solo.evaluate(() => {
      const svg = document.querySelector("body > svg");
      return window.pocExport.textCenters(svg, svg.getBoundingClientRect(), 1);
    });
    await solo.close();

    const pixel = diffRatio(shotA, soloShot);
    if (pixel.diff) await writeFile(`${OUT}/${name}-${method}-diff.png`, pixel.diff);
    const center = maxCenterDiff(centersA, soloCenters);
    const worst = Object.entries(centersA).map(([t, c]) => [t, soloCenters[t] ? Math.hypot(c.x - soloCenters[t].x, c.y - soloCenters[t].y) : null]).sort((x, y) => (y[1] ?? 999) - (x[1] ?? 999)).slice(0, 3);
    results[method] = {
      size: { width: out.width, height: out.height },
      exportMs: out.ms,
      svgBytes: out.svg.length,
      checks: checkSvg(out.svg, pageInfo),
      png: out.png.ok ? { ok: true, width: out.png.width, height: out.png.height, double: out.png.width === out.width * 2 && out.png.height === out.height * 2 } : out.png,
      pixel: { ratio: pixel.ratio, ratioShift1: diffRatioShift1(shotA, soloShot), size: pixel.size, pass: pixel.ratio !== null && pixel.ratio <= N },
      center: { max: center.max, missing: center.missing, worst, pass: center.max <= M && center.missing.length === 0 },
    };
  }
  await browser.close();
  return { jitter: { pixel: jitterPixel, center: jitterCenter }, thresholds: { N, M }, results };
}

const server = await serve("/work", PORT);
const report = {};
for (const name of Object.keys(ENGINES)) {
  try {
    report[name] = await runEngine(name);
  } catch (error) {
    report[name] = { error: String(error) };
  }
}
server.closeAllConnections();
server.close();
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
