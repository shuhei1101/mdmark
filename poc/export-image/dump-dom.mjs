import { chromium } from "playwright";
import { serve } from "./server.mjs";
const server = await serve("/work", 8765);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("console", (m) => console.log("console:", m.text())); page.on("response", (r) => { if (r.status() >= 400) console.log("404:", r.url()); });
await page.goto("http://localhost:8765/poc/export-image/index.html");
await page.waitForSelector(".mdmark-map .mdmark-diagram-wires", { state: "attached", timeout: 15000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const map = document.querySelector(".mdmark-map");
  const walk = (el, depth) => {
    if (depth > 6) return "";
    const cls = typeof el.className === "string" ? el.className : el.className.baseVal;
    let s = `${"  ".repeat(depth)}<${el.tagName.toLowerCase()} class="${cls}"> ${el.children.length === 0 ? (el.textContent || "").slice(0, 30) : ""}\n`;
    for (const c of [...el.children].slice(0, 12)) s += walk(c, depth + 1);
    return s;
  };
  return walk(map, 0);
});
console.log(info);
await page.screenshot({ path: "/work/poc/export-image/out/page.png", fullPage: true });
await browser.close();
server.close();
