// 縁の 1 px を除いて、方式 foreign の違う画素の割合を数え直す（そのまま / 1 px のずれを許す）
import { readFileSync } from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
const out = {};
for (const eng of ["chromium", "firefox", "webkit"]) {
  const a = PNG.sync.read(readFileSync(`out/${eng}-page.png`));
  const b = PNG.sync.read(readFileSync(`out/${eng}-exportForeign-solo.png`));
  const crop = (p) => {
    const w = p.width - 2, h = p.height - 2;
    const c = new PNG({ width: w, height: h });
    PNG.bitblt(p, c, 1, 1, w, h, 0, 0);
    return c;
  };
  const ca = crop(a), cb = crop(b);
  const diff = new PNG({ width: ca.width, height: ca.height });
  const n = pixelmatch(ca.data, cb.data, diff.data, ca.width, ca.height, { includeAA: false, threshold: 0.1 });
  let shift = 0;
  const near = (i, j) => Math.abs(ca.data[i] - cb.data[j]) + Math.abs(ca.data[i + 1] - cb.data[j + 1]) + Math.abs(ca.data[i + 2] - cb.data[j + 2]) <= 48;
  for (let y = 0; y < ca.height; y++) for (let x = 0; x < ca.width; x++) {
    const i = (y * ca.width + x) * 4; let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= ca.width || yy >= ca.height) continue;
      if (near(i, (yy * ca.width + xx) * 4)) ok = true;
    }
    if (!ok) shift++;
  }
  const total = ca.width * ca.height;
  out[eng] = { pixelmatch: +(n / total * 100).toFixed(4), shift1: +(shift / total * 100).toFixed(4) };
}
console.log(JSON.stringify(out));
