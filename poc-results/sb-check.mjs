import { chromium } from "playwright";
const SB = "http://127.0.0.1:46102", RENDER = "http://127.0.0.1:46101";
const out = process.argv[2];
const cases = [
  ["parts-notice--figure", "notice", { name: "chart", figure: "true" }],
  ["parts-notice--block", "notice", { name: "tabs", figure: "false" }],
  ["parts-table--data", "table", { kind: "data", features: '["sort","pin","filter"]', columns: '["記法","機能名","増分（KB）"]', rows: '[["表の操作","table","6.2"],["注意書き","callout","1.4"],["タブ","tabs","2.1"]]' }],
  ["vscode-previewstatus--offline", "preview-status", { state: "offline", version: "v0.7.0" }],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (const [id, part, args] of cases) {
  await page.goto(`${SB}/iframe.html?id=${id}&viewMode=story`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("#storybook-root .mdmark, #storybook-root .mdmark-preview-status", { timeout: 120000 });
  const got = await page.$eval("#storybook-root > div", (el) => el.innerHTML);
  const raw = await (await fetch(`${RENDER}/render/${part}?${new URLSearchParams(args)}`)).text();
  // 属性の書き方（hidden と hidden=""）をそろえるため、DOM に入れてから比べる
  const expected = await page.evaluate((html) => { const t = document.createElement("div"); t.innerHTML = html; return t.innerHTML; }, raw);
  console.log(id, "same:", got === expected, got.length, expected.length);
}
for (const [id, w, h] of [["vscode-previewstatusreact--offline", 1280, 800], ["vscode-previewstatusreact--offline", 390, 844]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto(`${SB}/iframe.html?id=${id}&viewMode=story`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForSelector('[data-slot="alert"]', { state: "attached", timeout: 120000 });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/status-react-${w}.png` });
}
const m = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await m.goto(`${SB}/?path=/story/parts-notice--figure&addonPanel=storybook/a11y/panel`);
await m.waitForTimeout(8000);
const panelText = await m.locator("#storybook-panel-root").innerText().catch(() => "");
console.log("a11y panel:", panelText.replace(/\s+/g, " ").slice(0, 300));
await m.screenshot({ path: `${out}/a11y-panel.png` });
await browser.close();
