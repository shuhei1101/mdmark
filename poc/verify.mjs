// PoC: 隠さない HTML と隠した HTML を開いて比べ、成功条件を突き合わせる
// 使用方法: node verify.mjs {隠さない HTML} {隠した HTML} {document|bundle}
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const [plainPath, hiddenPath, kind] = process.argv.slice(2);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok, detail });

// 残りの検査: 利用者が記載した値（payload の index・references・docs の title・path・docId・本文の地の文・<title>）を除いて mdmark と <!-- が無いか
const hidden = readFileSync(hiddenPath, "utf8");
const start = hidden.indexOf('<script type="application/json" id="zq-payload">');
const openEnd = hidden.indexOf(">", start) + 1;
const end = hidden.indexOf("</script>", openEnd);
const payload = JSON.parse(hidden.slice(openEnd, end));
const outside = (hidden.slice(0, start) + hidden.slice(end)).replace(/<title>[\s\S]*?<\/title>/, "");
const { index, references, docs, entry, aliases, includes, ...rest } = payload;
const generated = JSON.stringify(rest);
const markdown = docs.map((d) => d.markdown).join("\n");
const markdownForms = markdown.match(/(<\/?mdmark-|--mdmark-|class="[^"]*mdmark-|mdmark-asset:)/gi) ?? [];
record("残り: HTML の文字列（<title> を除く）の mdmark", !/mdmark/i.test(outside), `${(outside.match(/mdmark/gi) ?? []).length} 件`);
record("残り: 埋め込みの JSON の生成した値の mdmark", !/mdmark/i.test(generated), `${(generated.match(/mdmark/gi) ?? []).length} 件`);
record("残り: 本文の部品の要素名・CSS 変数・class の mdmark", markdownForms.length === 0, `${markdownForms.length} 件`);
record("コメント: HTML の文字列の <!--", !outside.includes("<!--"), `${(outside.match(/<!--/g) ?? []).length} 件`);
const nonMarker = (markdown.match(/<!--[\s\S]*?-->/g) ?? []).filter((c) => !/^<!--\s*\/?[a-z][a-z0-9-]*\s*(:[\s\S]*)?-->$/.test(c));
record("コメント: 埋め込みの Markdown のマーカーでない <!--", nonMarker.length === 0, `${nonMarker.length} 件`);
record("残す: 本文の地の文の mdmark", /mdmark は Markdown を描きます/.test(markdown));
record("残す: 文書のタイトル・パス・索引の用語", docs.some((d) => d.path === "mdmark-intro.md" && d.title === "mdmark の紹介") && index.terms[0].term === "mdmark" && /<title>[^<]*<\/title>/.test(hidden));

const browser = await chromium.launch();

async function open(path) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(resolve(path)).href + (kind === "bundle" ? "#/mdmark-intro.md" : ""));
  await page.waitForSelector("h1");
  await page.waitForFunction(() => document.querySelectorAll("svg").length >= 2, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { page, errors };
}

// DOM の要素を、別名を mdmark に戻した class と、計算後のスタイルで並べる
async function snapshot(page) {
  return page.evaluate(() => {
    const norm = (s) => s.replace(/zq/g, "mdmark").replace(/Zq/g, "Mdmark");
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      const cs = getComputedStyle(el);
      out.push([
        norm(el.tagName.toLowerCase()),
        norm(el.getAttribute("class") ?? ""),
        cs.display,
        cs.color,
        cs.backgroundColor,
        cs.fontSize,
        cs.letterSpacing,
        cs.borderRadius,
        Math.round(el.getBoundingClientRect().width),
      ].join("|"));
    }
    return out;
  });
}

const commentNodes = (page) =>
  page.evaluate(() => {
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
    let n = 0;
    while (walker.nextNode()) n++;
    return n;
  });

const plain = await open(plainPath);
const hid = await open(hiddenPath);
record("表示: コンソールのエラー（隠した HTML）", hid.errors.length === 0, hid.errors.slice(0, 3).join(" / "));
record("表示: コンソールのエラー（隠さない HTML、比較用）", plain.errors.length === 0, plain.errors.slice(0, 3).join(" / "));
record("コメント: 開いた後の DOM のコメントのノード", (await commentNodes(hid.page)) === 0, `${await commentNodes(hid.page)} 件（隠さない HTML は ${await commentNodes(plain.page)} 件）`);

const a = await snapshot(plain.page);
const b = await snapshot(hid.page);
const diff = [];
// 本文のコードの例（<mdmark-chart> が別名で表示される。確認ログで受け入れた）の中の要素は、幅だけが違う
const inCodeExample = await hid.page.evaluate(() => {
  const all = [...document.querySelectorAll("body *")].filter((el) => !(el.closest("svg") && el.tagName.toLowerCase() !== "svg"));
  return all.map((el) => Boolean(el.closest("pre")?.textContent.includes("-chart>{}")));
});
for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i] && !inCodeExample[i]) diff.push(`${i}: ${a[i]} ≠ ${b[i]}`);
const expected = inCodeExample.filter(Boolean).length;
record("表示: 要素・class・計算後のスタイルが同じ（本文のコードの例の中を除く）", diff.length === 0 && a.length === b.length, `要素 ${a.length} / ${b.length}、差 ${diff.length} 件（コードの例の中の要素 ${expected} 件は除外） ${diff.slice(0, 3).join(" ; ")}`);

const check = async (name, fn) => {
  const [x, y] = [await fn(plain.page, "mdmark"), await fn(hid.page, "zq")];
  record(name, JSON.stringify(x) === JSON.stringify(y) && x !== null && x !== false, `隠さない ${JSON.stringify(x)} / 隠した ${JSON.stringify(y)}`);
};

await check("表示: mermaid の図（既定のテーマ）", (p, n) => p.evaluate((n) => {
  const svg = document.querySelector(`.${n}-mermaid-frame svg, [class*="${n}-mermaid"] svg`);
  return svg ? getComputedStyle(svg.querySelector(".node rect, .node polygon, rect") ?? svg).fill : null;
}, n));
await check("本文の名前: <mdmark-chart> のグラフ", (p, n) => p.evaluate((n) => document.querySelectorAll(`.${n}-html svg`).length, n));
await check("本文の名前: 範囲の css の var(--mdmark-*) と theme.css の上書き", (p) => p.evaluate(() => getComputedStyle(document.querySelector(".box")).color));
await check("本文の名前: mdmark-align-center のクラス", (p, n) => p.evaluate((n) => { const e = document.querySelector(`p.${n}-align-center`); return e ? getComputedStyle(e).textAlign : "要素が無い"; }, n));
await check("利用側の CSS: theme.css の h1 と --mdmark-radius", (p, n) => p.evaluate((n) => [getComputedStyle(document.querySelector("h1")).letterSpacing, getComputedStyle(document.querySelector(`.${n}`)).getPropertyValue(`--${n}-radius`).trim()], n));
await check("拡張: greet の拡張が描く", (p) => p.evaluate(() => document.body.innerText.includes("こんにちは、利用者")));
await check("置き換えない語: 本文の地の文の mdmark", (p) => p.evaluate(() => document.body.innerText.includes("mdmark は Markdown を描きます")));
await check("操作: タブの切り替え", async (p) => {
  const tab = p.getByRole("tab", { name: "Windows" }).first();
  if (!(await tab.count())) return null;
  await tab.click();
  return p.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => t.getAttribute("aria-selected")));
});
await check("操作: 表の並べ替え", async (p) => {
  const head = p.locator("th", { hasText: "件数" }).first();
  const btn = head.locator("button").first();
  await ((await btn.count()) ? btn : head).click();
  return p.evaluate(() => [...document.querySelectorAll("table tbody tr td:first-child")].map((t) => t.textContent.trim()).slice(0, 3));
});
await check("操作: 用語のツールチップ（ワークスペース）", async (p) => {
  const term = p.locator("text=ワークスペース").first();
  await term.hover();
  await p.waitForTimeout(500);
  return p.evaluate(() => document.body.innerText.includes("作業のフォルダ"));
});
{
  const code = (p) => p.evaluate(() => [...document.querySelectorAll("pre code")].map((c) => c.textContent).find((t) => t.includes("-chart>{}")) ?? null);
  const [x, y] = [await code(plain.page), await code(hid.page)];
  record("受け入れる違い: 本文のコードの例の名前は別名で表示される", x?.includes("<mdmark-chart>") && y?.includes("<zq-chart>"), `隠さない ${JSON.stringify(x)} / 隠した ${JSON.stringify(y)}`);
}

if (kind === "bundle") {
  await check("操作: まとめた HTML の行き来（リンクと戻る）", async (p) => {
    await p.locator("article a", { hasText: "使い方" }).first().click();
    await p.waitForTimeout(800);
    const there = await p.evaluate(() => document.querySelector("h1")?.textContent);
    await p.locator("a", { hasText: "紹介へ戻る" }).first().click();
    await p.waitForTimeout(800);
    const back = await p.evaluate(() => document.querySelector("h1")?.textContent);
    await p.goBack();
    await p.waitForTimeout(800);
    return [there, back, await p.evaluate(() => document.querySelector("h1")?.textContent)];
  });
  await check("表示: 文書の一覧", (p, n) => p.evaluate((n) => [...document.querySelectorAll(`.${n}-bundle-side a`)].map((a) => a.textContent.trim()), n));
}

await browser.close();
for (const r of results) console.log(`${r.ok ? "OK  " : "NG  "}${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
