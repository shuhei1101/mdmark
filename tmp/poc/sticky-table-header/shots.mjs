// 案 C の留めた見出し行と集計の行のスクリーンショットを撮る
import { chromium } from "playwright";
const b = await chromium.launch();
for (const [w, h] of [[1280, 800], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto("http://127.0.0.1:4789/tmp/poc/sticky-table-header/page.html?mode=c&offset=48");
  await p.waitForSelector("html[data-ready='1']");
  await p.evaluate(async () => {
    const t = poc.tables[0];
    t.tHead.rows[0].cells[0].querySelector(".mdmark-pin").click();
    window.scrollTo(0, t.getBoundingClientRect().top + scrollY + 2000);
    t.scrollLeft = (t.scrollWidth - t.clientWidth) / 2;
    await new Promise((r) => requestAnimationFrame(r));
  });
  await p.screenshot({ path: `tmp/poc/sticky-table-header/screenshots/mode-c_${w}x${h}.png` });
  await p.close();
}
await b.close();
