import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { Rendered } from "../src/render.ts";
import { render } from "../src/render.ts";

// 検証のページを配る架空のオリジン
const PAGE_ORIGIN = "https://poc.test";
// 外部ライブラリの代役を配る架空のオリジン
const LIBRARY_URL = "https://cdn.test/demo@1.0.0/demo.js";
// 層の中の色（青）と層の外の色（赤）
const LAYER_COLOR = "rgb(0, 0, 255)";
const OUTSIDE_COLOR = "rgb(255, 0, 0)";

// 層の中に詳細度の高い規則、層の外に詳細度の低い規則を持つページ
const PAGE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
@layer mdmark {
  .mdmark p { color: ${LAYER_COLOR}; }
  .mdmark li { color: ${LAYER_COLOR}; }
}
p { color: ${OUTSIDE_COLOR}; }
</style>
</head>
<body><div id="doc" class="mdmark"></div></body>
</html>`;

// 見出し・段落・リスト・表・コードブロック・リンク・折り畳み・印を持つ見本
const SAMPLE = `<!-- features: +a -b -->

# 見出し

段落の文。<!-- unknown: 1 --> 続きの文と[リンク](https://example.com/)。

- 項目 1
- 項目 2

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |

\`\`\`js
const x = 1;
\`\`\`

<details>
<summary>折り畳み</summary>

中の文。

</details>
`;

// スクリプトを 4 通りに書いた見本
const SCRIPT_SAMPLE = `前の段落。

<script>window.__flag = "script"</script>

<a href="#" onclick="window.__flag = 'onclick'">属性のリンク</a>

<a href="javascript:window.__flag = 'href'">生のリンク</a>

[記法のリンク](javascript:window.__flag='markdown')

<details>
<summary>折り畳み</summary>

中の文。

</details>
`;

/** 検証のページと束ねた配布物を架空のオリジンから配り、ページを開く */
async function openPage(page: Page): Promise<void> {
  const bundle = await readFile(
    join(import.meta.dirname, "../dist/index.js"),
    "utf8",
  );
  await page.route(`${PAGE_ORIGIN}/**`, (route) => {
    const isBundle = route.request().url().endsWith("/index.js");
    return route.fulfill({
      contentType: isBundle ? "text/javascript" : "text/html",
      body: isBundle ? bundle : PAGE_HTML,
    });
  });
  await page.goto(`${PAGE_ORIGIN}/`);
}

/** 外部ライブラリの代役を配り、受けた要求の URL を記録する */
async function routeLibrary(
  page: Page,
  options: { status: 200 | 404 },
): Promise<string[]> {
  const requests: string[] = [];
  await page.route("https://cdn.test/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      status: options.status,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
      body:
        options.status === 200
          ? 'export function draw() { return "代役が描いた"; }'
          : "",
    });
  });
  return requests;
}

/** ページの中で mount を呼ぶ */
async function mountInPage(
  page: Page,
  options: { markdown: string; libraries: Record<string, string> },
): Promise<void> {
  await page.evaluate(
    async ({ origin, mountOptions }) => {
      const built = await import(`${origin}/index.js`);
      const el = document.getElementById("doc");
      await built.mount(el, mountOptions);
    },
    { origin: PAGE_ORIGIN, mountOptions: options },
  );
}

// DOM の無い Node とブラウザで、同じ HTML と印を返す（正常系）
test("render_when_node_and_browser", async ({ page }) => {
  // 準備
  await openPage(page);
  // 実行
  const inNode = render({ markdown: SAMPLE, libraryMarks: [] });
  const inBrowser: Rendered = await page.evaluate(
    async ({ origin, markdown }) => {
      const built = await import(`${origin}/index.js`);
      return built.render({ markdown, libraryMarks: [] });
    },
    { origin: PAGE_ORIGIN, markdown: SAMPLE },
  );
  // 検証
  expect(inBrowser).toEqual(inNode);
  expect(inNode.marks).toEqual([
    { name: "features", args: ["+a", "-b"] },
    { name: "unknown", args: ["1"] },
  ]);
  expect(inNode.html).not.toContain("<!--");
  expect(inNode.html).not.toContain("&lt;!--");
  for (const tag of ["<h1>", "<p>", "<ul>", "<table>", "<pre>", "<details>"]) {
    expect(inNode.html).toContain(tag);
  }
  expect(inNode.html).toContain('<a href="https://example.com/">');
});

// スクリプトを書いた文書を描いても、スクリプトが出力に残らず実行されない（正常系）
test("render_when_markdown_has_scripts", async ({ page }) => {
  // 準備
  await openPage(page);
  // 実行
  const { html } = render({ markdown: SCRIPT_SAMPLE, libraryMarks: [] });
  await mountInPage(page, { markdown: SCRIPT_SAMPLE, libraries: {} });
  await page.getByText("属性のリンク").click();
  await page.getByText("生のリンク").click();
  // 検証
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onclick");
  expect(html).not.toMatch(/href\s*=\s*["']?\s*javascript:/i);
  expect(html).toContain("<details>");
  expect(await page.evaluate(() => "__flag" in window)).toBe(false);
  await expect(page.getByText("前の段落。")).toBeVisible();
});

// 印の無い文書では、外部ライブラリへの要求が 0 件（正常系）
test("mount_when_markdown_has_no_library_mark", async ({ page }) => {
  // 準備
  await openPage(page);
  const requests = await routeLibrary(page, { status: 200 });
  // 実行
  await mountInPage(page, {
    markdown: "段落だけの文書。",
    libraries: { demo: LIBRARY_URL },
  });
  // 検証
  expect(requests).toEqual([]);
});

// 印のある文書では、対応表の URL を import() に渡して 1 回だけ読み、モジュールの関数を呼べる（正常系）
test("mount_when_markdown_has_library_mark", async ({ page }) => {
  // 準備
  await openPage(page);
  const requests = await routeLibrary(page, { status: 200 });
  // 実行
  await mountInPage(page, {
    markdown: "前の段落。\n\n<!-- demo: x -->\n\n後の段落。",
    libraries: { demo: LIBRARY_URL },
  });
  // 検証
  expect(requests).toEqual([LIBRARY_URL]);
  await expect(page.locator("[data-mdmark-slot]")).toHaveText("代役が描いた");
});

// 外部ライブラリを読めないとき、その場所に知らせの枠を出し、ほかの本文は描く（異常系）
test("mount_when_library_not_found", async ({ page }) => {
  // 準備
  await openPage(page);
  await routeLibrary(page, { status: 404 });
  // 実行
  await mountInPage(page, {
    markdown: "前の段落。\n\n<!-- demo: x -->\n\n後の段落。",
    libraries: { demo: LIBRARY_URL },
  });
  // 検証
  await expect(page.getByRole("note")).toHaveText(
    "外部ライブラリを読めませんでした: demo",
  );
  await expect(page.getByText("前の段落。")).toBeVisible();
  await expect(page.getByText("後の段落。")).toBeVisible();
});

// 層の外の詳細度の低い規則が、層の中の詳細度の高い規則に勝つ（正常系）
test("layer_when_outside_rule_has_lower_specificity", async ({ page }) => {
  // 準備
  await openPage(page);
  // 実行
  await mountInPage(page, { markdown: "段落。\n\n- 項目", libraries: {} });
  const colorOf = (selector: string) =>
    page
      .locator(selector)
      .evaluate((element) => getComputedStyle(element).color);
  // 検証
  expect(await colorOf("#doc p")).toBe(OUTSIDE_COLOR);
  // 層の外に規則の無い要素には、層の中の規則が当たる
  expect(await colorOf("#doc li")).toBe(LAYER_COLOR);
});
