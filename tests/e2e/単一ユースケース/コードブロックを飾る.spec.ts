import { expect, type Page, test } from "@playwright/test";
import { stubClipboard, writtenTexts } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeSyntax,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 3 行の言語 `ts` のコードブロック
const THREE_LINES = [
  "```ts",
  "const a = 1;",
  "const b = 2;",
  "const c = 3;",
  "```",
];

// 色分けする言語（`ts`・`yaml`・`python`）のコードブロックを 1 つずつ配置した文書
const HIGHLIGHT_BLOCKS = [
  "```ts",
  'const greeting: string = "hello"; // 挨拶',
  "```",
  "",
  "```yaml",
  "name: mdmark",
  "count: 3",
  "```",
  "",
  "```python",
  "def greet(name):",
  '    return "hi"  # 挨拶',
  "```",
  "",
].join("\n");

// 色分けの前後で変わらない、各コードブロックの文字
const HIGHLIGHT_TEXTS = [
  'const greeting: string = "hello"; // 挨拶',
  "name: mdmark\ncount: 3",
  'def greet(name):\n    return "hi"  # 挨拶',
];

// 色分けのライブラリを読み込み終えるのを待つ時間の上限、読み込まないことを確認するために待つ時間（ミリ秒）
const SETTLE_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** コードブロックの文字を全て選び、選んだ文字を返却する */
async function selectedCode(page: Page): Promise<string> {
  return await page
    .locator("#doc pre")
    .first()
    .evaluate((pre) => {
      const selection = window.getSelection();
      selection?.selectAllChildren(pre);
      return selection?.toString() ?? "";
    });
}

/** 行の背景色が透明でないか */
async function hasBackground(
  line: ReturnType<Page["locator"]>,
): Promise<boolean> {
  const color = await line.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  return color !== "rgba(0, 0, 0, 0)" && color !== "transparent";
}

// タイトル・行番号・行の強調を付け、行番号は選んで写す文字に入らない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- code: {"title": "app.ts", "lines": {}, "highlight": [2]} -->',
      "",
      ...THREE_LINES,
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-code-title")).toContainText("app.ts");
  await expect(doc.locator(".mdmark-code-lang-name")).toHaveText("ts");
  const lines = doc.locator(".mdmark-code-line");
  await expect(lines).toHaveCount(3);
  for (const [index, number] of ["1", "2", "3"].entries()) {
    const content = await lines
      .nth(index)
      .evaluate((element) => getComputedStyle(element, "::before").content);
    expect(content).toContain(number);
  }
  expect(await hasBackground(lines.nth(0))).toBe(false);
  expect(await hasBackground(lines.nth(1))).toBe(true);
  expect(await hasBackground(lines.nth(2))).toBe(false);
  await expect(lines.nth(1)).toHaveAttribute("data-kind", "highlight");
  const copied = await selectedCode(page);
  expect(copied).not.toMatch(/^\d/m);
  expect(copied).toContain("const a = 1;");
});

// 行末のマーカーで行に種類を付け、マーカーとマーカーだけの行コメントの頭を削除する（正常シナリオ（コードの行のマーカー））
test("test_normal_when_line_marks", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```ts",
      "let count = 0; // [!code --]",
      "let count = 1; // [!code ++]",
      "count += 1; // 数える [!code highlight]",
      "console.log(count);",
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  const lines = doc.locator(".mdmark-code-line");
  await expect(lines).toHaveCount(4);
  await expect(lines.nth(0)).toHaveAttribute("data-kind", "del");
  await expect(lines.nth(1)).toHaveAttribute("data-kind", "add");
  await expect(lines.nth(2)).toHaveAttribute("data-kind", "highlight");
  const signs = await lines.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, "::after").content),
  );
  expect(signs[0]).toContain("-");
  expect(signs[1]).toContain("+");
  for (const index of [0, 1, 2]) {
    expect(await hasBackground(lines.nth(index))).toBe(true);
  }
  expect(await hasBackground(lines.nth(3))).toBe(false);
  const text = await doc.locator("pre").innerText();
  expect(text).not.toContain("[!code");
  expect(text).toContain("let count = 0;");
  expect(text).not.toContain("let count = 0; //");
  expect(text).toContain("count += 1; // 数える");
  expect(text).toContain("console.log(count);");
  const copied = await selectedCode(page);
  expect(copied).not.toMatch(/^[+-]/m);
});

// 打ち消したマーカーは、`\` を削除した文字のまま出す（正常シナリオ（マーカーの記載方法を見せる））
test("test_normal_when_line_mark_escaped", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ["```ts", "let count = 1; // [\\!code ++]", "```", ""].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("pre")).toContainText("// [!code ++]");
  await expect(doc.locator("pre")).not.toContainText("\\");
  await expect(doc.locator('.mdmark-code-line[data-kind="add"]')).toHaveCount(
    0,
  );
  const after = await doc
    .locator("pre code")
    .evaluate((element) => getComputedStyle(element, "::after").content);
  expect(after).not.toContain("+");
});

// 機能をオフにした文書は、タイトル・行番号・行の強調を付けず、行のマーカーを記載した文字のまま出す（正常シナリオ（機能をオフにした文書））
test("test_normal_when_feature_off", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- features: {"code": false} -->',
      "",
      '<!-- code: {"title": "app.ts", "lines": {}, "highlight": [2]} -->',
      "",
      ...THREE_LINES,
      "",
      "```ts",
      "let count = 1; // [!code ++]",
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-code-title")).toHaveCount(0);
  await expect(doc.locator(".mdmark-code-line")).toHaveCount(0);
  await expect(doc.locator(".mdmark-code-lang")).toHaveCount(0);
  await expect(doc.locator(".mdmark-code-copy")).toHaveCount(0);
  await expect(doc.getByText("app.ts")).toHaveCount(0);
  await expect(doc.locator("pre").nth(1)).toContainText("// [!code ++]");
});

// 知らないキーはスキップし、記載の警告を出さずに読み込めたタイトルを付ける（正常シナリオ（知らないキー））
test("test_normal_when_unknown_key", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- code: {"title": "app.ts", "color": "red"} -->',
      "",
      ...THREE_LINES,
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-syntax-warning")).toHaveCount(0);
  await expect(doc.locator(".mdmark-code-title")).toContainText("app.ts");
});

// 空白を含むタイトルを出し、行番号を lines.start の番号から始めて強調の行を合わせる（正常シナリオ（空白を含むタイトルと行番号の開始の番号））
test("test_normal_when_title_with_space_and_line_start", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- code: {"title": "src/app.ts の抜粋", "lines": {"start": 10}, "highlight": [{"from": 11, "to": 12}]} -->',
      "",
      ...THREE_LINES,
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-code-title")).toContainText(
    "src/app.ts の抜粋",
  );
  const lines = doc.locator(".mdmark-code-line");
  await expect(lines).toHaveCount(3);
  for (const [index, number] of ["10", "11", "12"].entries()) {
    const content = await lines
      .nth(index)
      .evaluate((element) => getComputedStyle(element, "::before").content);
    expect(content).toContain(number);
  }
  expect(await hasBackground(lines.nth(0))).toBe(false);
  expect(await hasBackground(lines.nth(1))).toBe(true);
  expect(await hasBackground(lines.nth(2))).toBe(true);
  await expect(doc.locator(".mdmark-syntax-warning")).toHaveCount(0);
});

// コードブロックに無い行の番号は当てずに警告にし、ある行だけを強調する（異常シナリオ（コードブロックに無い行の番号））
test("test_error_when_highlight_line_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- code: {"highlight": [2, 5]} -->',
      "",
      ...THREE_LINES,
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  const warning = doc.locator(".mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("5");
  await expect(warning).toContainText("3 行");
  const lines = doc.locator(".mdmark-code-line");
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(1)).toHaveAttribute("data-kind", "highlight");
  expect(await hasBackground(lines.nth(1))).toBe(true);
  await expect(
    doc.locator('.mdmark-code-line[data-kind="highlight"]'),
  ).toHaveCount(1);
});

// 知らないコードの行のマーカーは当てずに警告にし、記載した文字のまま出す（異常シナリオ（知らないコードの行のマーカー））
test("test_error_when_unknown_line_mark", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ["```ts", "foo(); // [!code blink]", "```", ""].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  const warning = doc.locator(".mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("[!code blink]");
  for (const mark of ["[!code ++]", "[!code --]", "[!code highlight]"]) {
    await expect(warning).toContainText(mark);
  }
  await expect(doc.locator("pre")).toContainText("foo(); // [!code blink]");
  await expect(doc.locator(".mdmark-code-line")).toHaveCount(0);
});

// マーカーの後にコードブロックが無いときは警告にし、段落をそのまま出す（異常シナリオ（マーカーの後にコードブロックが無い））
test("test_error_when_no_code_block", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ['<!-- code: {"title": "app.ts"} -->', "", "直後の段落", ""].join(
      "\n",
    ),
  });
  // 検証
  const doc = page.locator("#doc");
  const warning = doc.locator(".mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("直後にコードブロックがありません");
  await expect(doc.locator("p", { hasText: "直後の段落" })).toBeVisible();
  await expect(doc.locator(".mdmark-code-title")).toHaveCount(0);
});

/** 開いたページの `console.error` の文字を記録し、記録した文字を返却する関数を返却する */
function collectConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return () => errors;
}

/** `#doc` の色の変数 `name` が今の配色で指す色（`rgb(…)`）を返却する */
async function themeColor(page: Page, name: string): Promise<string> {
  return await page.locator("#doc").evaluate((doc, variable) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${variable})`;
    doc.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

/** コードブロックごとに、`hljs-` で始まる class の `span` の数を返却する */
async function coloredSpanCounts(page: Page): Promise<number[]> {
  return await page
    .locator("#doc pre code")
    .evaluateAll((codes) =>
      codes.map((code) => code.querySelectorAll('span[class*="hljs-"]').length),
    );
}

/** コードブロックごとに、文字を全て選んだときの選んだ文字を返却する */
async function selectedTexts(page: Page): Promise<string[]> {
  return await page.locator("#doc pre").evaluateAll((pres) =>
    pres.map((pre) => {
      const selection = window.getSelection();
      selection?.selectAllChildren(pre);
      return (selection?.toString() ?? "").trim();
    }),
  );
}

// 言語に応じてコードブロックを色分けし、文字は記載したとおりで、本体と使用する言語のモジュールだけを読み込む（正常シナリオ（言語に応じて色分けする））
test("test_normal_when_syntax_highlighted", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: HIGHLIGHT_BLOCKS });
  // 検証
  await expect
    .poll(async () => (await coloredSpanCounts(page)).every((n) => n > 0))
    .toBe(true);
  const codes = page.locator("#doc pre code");
  await expect(codes).toHaveCount(3);
  // キーワード・文字列・コメントなどが、地の文字と違う色で出ている
  const colors = await codes.evaluateAll((elements) =>
    elements.map((code) => ({
      base: getComputedStyle(code).color,
      spans: [...code.querySelectorAll('span[class*="hljs-"]')].map(
        (span) => getComputedStyle(span).color,
      ),
    })),
  );
  for (const { base, spans } of colors) {
    expect(spans.some((color) => color !== base)).toBe(true);
  }
  await expect(page.locator("#doc .hljs-keyword").first()).toHaveCSS(
    "color",
    await themeColor(page, "--mdmark-color-syntax-keyword"),
  );
  await expect(page.locator("#doc .hljs-comment").first()).toHaveCSS(
    "color",
    await themeColor(page, "--mdmark-color-syntax-comment"),
  );
  // 文字は記載したとおりで、全て選んでコピーした文字が色分けの前と同じ
  expect(await selectedTexts(page)).toEqual(HIGHLIGHT_TEXTS);
  // 本体と、文書が使用する言語のモジュールを 1 件ずつ読み込む
  expect(requests()).toEqual([
    "core.min.js",
    "languages/python.min.js",
    "languages/typescript.min.js",
    "languages/yaml.min.js",
  ]);
});

// タイトル・行番号・コードの行のマーカーを保ったまま、行ごとに中身を色分けする（正常シナリオ（タイトル・行番号・コードの行のマーカーと色分けする））
test("test_normal_when_highlighted_with_line_marks", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- code: {"title": "app.ts", "lines": {}, "highlight": [4]} -->',
      "",
      "```ts",
      "/*",
      " * 説明",
      " */",
      "const base = 1;",
      "let count = 0; // [!code --]",
      "let count = 1; // [!code ++]",
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-code-line .hljs-comment")).toHaveCount(3);
  expect(requests()).toEqual(["core.min.js", "languages/typescript.min.js"]);
  await expect(doc.locator(".mdmark-code-title")).toContainText("app.ts");
  const lines = doc.locator(".mdmark-code-line");
  await expect(lines).toHaveCount(6);
  for (const [index, number] of ["1", "2", "3", "4", "5", "6"].entries()) {
    const content = await lines
      .nth(index)
      .evaluate((element) => getComputedStyle(element, "::before").content);
    expect(content).toContain(number);
  }
  // ブロックコメントの 3 行が、どの行もコメントの色で出ている
  const comment = await themeColor(page, "--mdmark-color-syntax-comment");
  for (const index of [0, 1, 2]) {
    await expect(lines.nth(index).locator(".hljs-comment").first()).toHaveCSS(
      "color",
      comment,
    );
  }
  // 削除した行・追加した行が、それぞれの地の色と行頭のマーカーで出ていて、行の中の文字は色分けされている
  await expect(lines.nth(4)).toHaveAttribute("data-kind", "del");
  await expect(lines.nth(5)).toHaveAttribute("data-kind", "add");
  const signs = await lines.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, "::after").content),
  );
  expect(signs[4]).toContain("-");
  expect(signs[5]).toContain("+");
  expect(await hasBackground(lines.nth(4))).toBe(true);
  expect(await hasBackground(lines.nth(5))).toBe(true);
  await expect(lines.nth(4).locator(".hljs-keyword")).toHaveText("let");
  await expect(lines.nth(5).locator(".hljs-keyword")).toHaveText("let");
  // 4 行目が強調の背景になっている
  await expect(lines.nth(3)).toHaveAttribute("data-kind", "highlight");
  expect(await hasBackground(lines.nth(3))).toBe(true);
  // 全て選んだ文字に、行番号と行頭のマーカーが入らず、マーカーの文字も出ない
  const copied = (await selectedTexts(page))[0] ?? "";
  expect(copied).not.toMatch(/^\d/m);
  expect(copied).not.toMatch(/^[+-]/m);
  expect(copied).not.toContain("[!code");
});

// 言語の無いコードブロックと、色分けしない言語のコードブロックは、記載したとおりに出し、ライブラリを読み込まない（正常シナリオ（色分けしない言語））
test("test_normal_when_language_not_highlighted", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```",
      "言語の無い文字",
      "```",
      "",
      "```text",
      "text の文字",
      "```",
      "",
    ].join("\n"),
  });
  await page.waitForTimeout(SETTLE_MS);
  // 検証
  expect(await selectedTexts(page)).toEqual(["言語の無い文字", "text の文字"]);
  expect(await coloredSpanCounts(page)).toEqual([0, 0]);
  expect(requests()).toEqual([]);
});

// 色分けの機能をオフにした文書は、色分けせず、行のマーカーを付けたコードブロックをそのまま描く（正常シナリオ（色分けの機能をオフにした文書））
test("test_normal_when_syntax_feature_off", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- features: {"syntax": false} -->',
      "",
      "```ts",
      "let count = 1; // [!code ++]",
      "```",
      "",
    ].join("\n"),
  });
  await page.waitForTimeout(SETTLE_MS);
  // 検証
  const line = page.locator("#doc .mdmark-code-line");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveAttribute("data-kind", "add");
  expect(await hasBackground(line)).toBe(true);
  const sign = await line.evaluate(
    (element) => getComputedStyle(element, "::after").content,
  );
  expect(sign).toContain("+");
  expect(await coloredSpanCounts(page)).toEqual([0]);
  expect(await selectedTexts(page)).toEqual(["let count = 1;"]);
  expect(requests()).toEqual([]);
});

// 色分けのライブラリの本体を読み込めないとき、コードブロックを色分けせずに欠けずに出し、通知ブロックは出さずにコンソールへ出す（異常シナリオ（色分けのライブラリを読み込めない））
test("test_error_when_highlighter_not_found", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page, { missing: ["core.min.js"] });
  const errors = collectConsoleErrors(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: HIGHLIGHT_BLOCKS });
  // 検証
  await expect
    .poll(() => errors().some((text) => text.includes("core.min.js")))
    .toBe(true);
  expect(requests()).toEqual(["core.min.js"]);
  expect(await selectedTexts(page)).toEqual(HIGHLIGHT_TEXTS);
  expect(await coloredSpanCounts(page)).toEqual([0, 0, 0]);
  await expect(page.locator("#doc .mdmark-notice")).toHaveCount(0);
});

// 言語のモジュールの一部を読み込めないとき、読み込めた言語のコードブロックだけを色分けし、読み込めなかった言語はコンソールへ出す（異常シナリオ（言語のモジュールの一部を読み込めない））
test("test_error_when_language_module_not_found", async ({ page }) => {
  // 準備
  await routeSyntax(page, { missing: ["languages/python.min.js"] });
  const errors = collectConsoleErrors(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: HIGHLIGHT_BLOCKS });
  // 検証
  await expect
    .poll(async () => (await coloredSpanCounts(page)).map((count) => count > 0))
    .toEqual([true, true, false]);
  await expect
    .poll(() =>
      errors().some((text) => text.includes("languages/python.min.js")),
    )
    .toBe(true);
  expect(await selectedTexts(page)).toEqual(HIGHLIGHT_TEXTS);
  await expect(page.locator("#doc .mdmark-notice")).toHaveCount(0);
});

// 言語の指定があるコードブロックの上の帯の左端に言語のラベルを出し、選んだ文字に入れず、スクリーンリーダー向けの名前は変えない（正常シナリオ（言語のラベルを出す））
test("test_normal_when_language_label_shown", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```ts",
      "const a = 1;",
      "```",
      "",
      "```bash title",
      "echo hi",
      "```",
      "",
      "```",
      "言語の無い文字",
      "```",
      "",
    ].join("\n"),
  });
  // 検証: 言語のあるコードブロックに、帯の左端のラベルがある
  const blocks = page.locator("#doc .mdmark-code");
  await expect(blocks).toHaveCount(3);
  await expect(blocks.nth(0).locator(".mdmark-code-lang-name")).toHaveText(
    "ts",
  );
  await expect(blocks.nth(1).locator(".mdmark-code-lang-name")).toHaveText(
    "bash",
  );
  await expect(blocks.nth(2).locator(".mdmark-code-lang")).toHaveCount(0);
  const placement = await blocks.nth(0).evaluate((block) => {
    const bar = block
      .querySelector(".mdmark-code-bar")
      ?.getBoundingClientRect();
    const label = block
      .querySelector(".mdmark-code-lang")
      ?.getBoundingClientRect();
    const pre = block.querySelector("pre")?.getBoundingClientRect();
    return {
      aboveCode: (bar?.bottom ?? 0) <= (pre?.top ?? 0) + 1,
      atLeft: (label?.left ?? 99) - (bar?.left ?? 0) < 24,
    };
  });
  expect(placement).toEqual({ aboveCode: true, atLeft: true });
  // 検証: コードブロックを全て選んだ文字に、ラベルが入っていない
  const selected = await blocks.nth(1).evaluate((block) => {
    const selection = window.getSelection();
    selection?.selectAllChildren(block);
    return selection?.toString() ?? "";
  });
  expect(selected).toContain("echo hi");
  expect(selected).not.toContain("bash");
  // 検証: スクリーンリーダー向けの名前は今のまま
  await expect(blocks.nth(0).locator("pre")).toHaveAttribute(
    "aria-label",
    "コード: ts",
  );
  await expect(blocks.nth(1).locator("pre")).toHaveAttribute(
    "aria-label",
    "コード: bash",
  );
  await expect(blocks.nth(2).locator("pre")).toHaveAttribute(
    "aria-label",
    "コード",
  );
});

// コピーボタンで、削除した行を含めない変更後のコードをコピーし、ボタンで通知し、しばらくすると元に戻す（正常シナリオ（変更後のコードをコピーする））
test("test_normal_when_code_copied", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "```ts",
      "const a = 1; // [!code --]",
      "const a = 2; // [!code ++]",
      "count += 1; // 数える [!code highlight]",
      "return a;",
      "```",
      "",
      "```tree",
      "src/",
      "  index.ts",
      "```",
      "",
    ].join("\n"),
    config: { features: { syntax: false } },
  });
  const buttons = page.locator("#doc button.mdmark-code-copy");
  // 検証: ファイルツリーのコードブロックにはコードブロックの帯とコピーボタンが無く、ツリーの帯のコピーボタンだけがある
  await expect(buttons).toHaveCount(1);
  await expect(page.locator("#doc .mdmark-tree .mdmark-code")).toHaveCount(0);
  await expect(
    page.locator("#doc .mdmark-tree button.mdmark-tree-copy"),
  ).toHaveCount(1);
  // 実行: キーボードでコピーボタンにフォーカスして押す
  await page.keyboard.press("Tab");
  await expect(buttons).toBeFocused();
  await page.keyboard.press("Enter");
  // 検証: 削除した行とマーカー、行番号と行頭の `+`・`-` を含まない変更後のコードをコピーする
  await expect(buttons).toContainText("コピーしました");
  expect(await writtenTexts(page)).toEqual([
    "const a = 2;\ncount += 1; // 数える\nreturn a;",
  ]);
  await expect(page.locator("#doc .mdmark-code-status")).toContainText(
    "コードをコピーしました",
  );
  // 検証: しばらくするとボタンの文言が元に戻る
  await expect(buttons).toHaveText("コピー");
});

// 色分けのライブラリを `dockerfile`・`diff` の言語のモジュールまで読み込み、別名のコードブロックも色分けし、追加した行のマーカーと両立する（正常シナリオ（Dockerfile と diff を色分けする））
test("test_normal_when_dockerfile_and_diff_highlighted", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```dockerfile",
      "FROM node:20",
      "RUN npm ci",
      "```",
      "",
      "```docker",
      "FROM node:20",
      "```",
      "",
      "```diff",
      "-removed",
      "+added",
      "+marked # [!code ++]",
      "```",
      "",
      "```patch",
      "-old",
      "+new",
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const code = (language: string) =>
    page.locator(`#doc code.language-${language}`);
  await expect(code("patch").locator(".hljs-addition")).toHaveCount(1);
  // 色分けのライブラリへの要求は、本体 1 件と言語のモジュール 1 件ずつ
  expect(requests()).toEqual([
    "core.min.js",
    "languages/diff.min.js",
    "languages/dockerfile.min.js",
  ]);
  // 命令が、地の文字と違う色で出ている
  for (const language of ["dockerfile", "docker"]) {
    const keyword = code(language).locator(".hljs-keyword").first();
    await expect(keyword).toBeVisible();
    expect(
      await keyword.evaluate(
        (el, base) => getComputedStyle(el).color !== base,
        await code(language).evaluate((el) => getComputedStyle(el).color),
      ),
    ).toBe(true);
  }
  // `+` で始まる行と `-` で始まる行が、地の文字とも互いとも違う色で出ている
  for (const language of ["diff", "patch"]) {
    const base = await code(language).evaluate(
      (el) => getComputedStyle(el).color,
    );
    const added = await code(language)
      .locator(".hljs-addition")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    const deleted = await code(language)
      .locator(".hljs-deletion")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(new Set([base, added, deleted]).size).toBe(3);
  }
  // `[!code ++]` を付けた行が追加した行の地の色と行頭の `+` で出ていて、行の中の文字は色分けされている
  const marked = page.locator(
    '#doc code.language-diff .mdmark-code-line[data-kind="add"]',
  );
  await expect(marked).toHaveCount(1);
  expect(await hasBackground(marked)).toBe(true);
  expect(
    await marked.evaluate((el) => getComputedStyle(el, "::after").content),
  ).toContain("+");
  await expect(marked.locator("span[class*='hljs-']")).not.toHaveCount(0);
  // 各コードブロックのラベルは記載した情報文字列のとおり
  await expect(page.locator("#doc .mdmark-code-lang-name")).toHaveText([
    "dockerfile",
    "docker",
    "diff",
    "patch",
  ]);
});

// クリップボードへの書き込みが拒まれたら、ボタンで通知し、コードブロックの文字は選んで手でコピーできる（異常シナリオ（クリップボードに書き込めない））
test("test_error_when_clipboard_denied", async ({ page }) => {
  // 準備
  await stubClipboard(page, "deny");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: ["```ts", "const a = 1;", "```", ""].join("\n"),
    config: { features: { syntax: false } },
  });
  const button = page.locator("#doc button.mdmark-code-copy");
  // 実行
  await button.click();
  // 検証: ボタンとスクリーンリーダーで、コピーできなかったことが知らされる
  await expect(button).toContainText("コピーできませんでした");
  await expect(button).toHaveAttribute("data-state", "failed");
  await expect(page.locator("#doc .mdmark-code-status")).toContainText(
    "コードをコピーできませんでした",
  );
  // 検証: コードブロックの文字を選べる
  expect(await selectedCode(page)).toContain("const a = 1;");
});

// 情報文字列の `:` の前を言語、後ろをファイル名として、帯の左端に並べて出し、言語で色分けする（正常シナリオ（言語とファイル名をラベルに出す））
test("test_normal_when_language_and_file_name_label_shown", async ({
  page,
}) => {
  // 準備
  await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```python:hoge.py",
      "def hello():",
      "    return 1",
      "```",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const blocks = page.locator("#doc .mdmark-code");
  await expect(blocks).toHaveCount(2);
  await expect(blocks.nth(0).locator(".mdmark-code-lang-name")).toHaveText(
    "python",
  );
  await expect(blocks.nth(0).locator(".mdmark-code-file")).toHaveText(
    "hoge.py",
  );
  const order = await blocks.nth(0).evaluate((block) => {
    const name = block
      .querySelector(".mdmark-code-lang-name")
      ?.getBoundingClientRect();
    const file = block
      .querySelector(".mdmark-code-file")
      ?.getBoundingClientRect();
    return (file?.left ?? 0) >= (name?.right ?? 1);
  });
  expect(order).toBe(true);
  await expect(blocks.nth(0).locator("pre code")).toHaveClass(
    "language-python",
  );
  await expect(blocks.nth(0).locator(".hljs-keyword").first()).toBeVisible();
  await expect(blocks.nth(1).locator(".mdmark-code-lang-name")).toHaveText(
    "ts",
  );
  await expect(blocks.nth(1).locator(".mdmark-code-file")).toHaveCount(0);
});

/** 行の不透明度 */
async function opacityOf(line: ReturnType<Page["locator"]>): Promise<number> {
  return Number(
    await line.evaluate((element) => getComputedStyle(element).opacity),
  );
}

/** 行の `::after` の `content`（代替テキストを含む） */
async function afterContent(
  line: ReturnType<Page["locator"]>,
): Promise<string> {
  return line.evaluate(
    (element) => getComputedStyle(element, "::after").content,
  );
}

// focus の行のほかを薄くし、error と warning の行を色とスクリーンリーダーで分け、マーカーを除いた全ての行をコピーする（正常シナリオ（focus・error・warning の行））
test("test_normal_when_focus_error_warning", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "```ts",
      "foo(); // [!code focus]",
      "bar(); // [!code error]",
      "baz(); // [!code warning]",
      "qux();",
      "```",
      "",
    ].join("\n"),
    config: { features: { syntax: false } },
  });
  await page.mouse.move(0, 0);
  // 検証: focus の行のほかが薄い
  const lines = page.locator("#doc .mdmark-code-line");
  await expect(lines).toHaveCount(4);
  await expect.poll(() => opacityOf(lines.nth(0))).toBe(1);
  for (const index of [1, 2, 3]) {
    await expect.poll(() => opacityOf(lines.nth(index))).toBeLessThan(1);
  }
  // 検証: error と warning の行の背景色が互いに異なり、色以外にスクリーンリーダーの文字を持つ
  const backgrounds = await Promise.all(
    [1, 2, 3].map((index) =>
      lines
        .nth(index)
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ),
  );
  expect(new Set(backgrounds).size).toBe(3);
  await expect(lines.nth(1)).toHaveAttribute("data-kind", "error");
  await expect(lines.nth(2)).toHaveAttribute("data-kind", "warning");
  expect(await afterContent(lines.nth(1))).toContain("エラーの行");
  expect(await afterContent(lines.nth(2))).toContain("警告の行");
  // 検証: マーカーの文字と行コメントの頭が出ていない
  const code = page.locator("#doc pre code");
  await expect(code).not.toContainText("[!code");
  await expect(code).not.toContainText("//");
  // 実行: コピーボタンを押す
  await page.locator("#doc button.mdmark-code-copy").click();
  // 検証
  await expect
    .poll(() => writtenTexts(page))
    .toEqual(["foo();\nbar();\nbaz();\nqux();"]);
});

/** 3 階層の入れ子のキーを持つ yaml・閉じ括弧の行で終わる json・tree のコードブロックを持つ文書 */
const FOLD_MARKDOWN = [
  "```yaml",
  "a:",
  "  b:",
  "    c: 1",
  "  d: 2",
  "e: 3",
  "```",
  "",
  "```json",
  "{",
  '  "outer": {',
  '    "inner": 1',
  "  }",
  "}",
  "```",
  "",
  "```tree",
  "src/",
  "  index.ts",
  "```",
  "",
].join("\n");

/** `block` 番目のコードブロックの行 */
function blockLines(page: Page, block: number): ReturnType<Page["locator"]> {
  return page
    .locator("#doc pre:has(.mdmark-code-line)")
    .nth(block)
    .locator(".mdmark-code-line");
}

/** 行の開閉のボタン */
function foldButton(
  line: ReturnType<Page["locator"]>,
): ReturnType<Page["locator"]> {
  return line.locator(":scope > .mdmark-code-fold");
}

/** 行ごとに表示しているかを並べて返却する */
async function visibleLines(
  lines: ReturnType<Page["locator"]>,
): Promise<boolean[]> {
  return lines.evaluateAll((elements) =>
    elements.map((element) => !(element as HTMLElement).hidden),
  );
}

// インデントの深い行を ▾ で畳み、⋯ で開き、Shift で入れ子をまとめて開閉し、json は閉じ括弧の行を残す（正常シナリオ（インデントで畳む・開く））
test("test_normal_when_folded_by_indent", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: FOLD_MARKDOWN,
    config: { features: { syntax: false } },
  });
  const yaml = blockLines(page, 0);
  const first = foldButton(yaml.nth(0));
  const second = foldButton(yaml.nth(1));
  // 検証: 描いた直後は全ての行が出ていて、▾ は行番号の右にあり、ポインターを乗せた行にだけ出る
  await page.mouse.move(0, 0);
  expect(await visibleLines(yaml)).toEqual([true, true, true, true, true]);
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveCSS("opacity", "0");
  const buttonBox = await first.boundingBox();
  const textBox = await yaml.nth(0).locator(".mdmark-code-text").boundingBox();
  expect(buttonBox?.x ?? 0).toBeGreaterThan(
    (await yaml.nth(0).boundingBox())?.x ?? 0,
  );
  expect((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0)).toBeLessThanOrEqual(
    (textBox?.x ?? 0) + 1,
  );
  await yaml.nth(0).locator(".mdmark-code-text").hover();
  await expect(first).toHaveCSS("opacity", "1");
  // 実行: 1 行目の ▾ を押す
  await first.click();
  // 検証: 次の同じ深さの行の手前まで隠れ、▸ と行数を持たない ⋯ が出る
  await expect(first).toHaveAttribute("aria-expanded", "false");
  expect(await visibleLines(yaml)).toEqual([true, false, false, false, true]);
  await page.mouse.move(0, 0);
  await expect(first).toHaveCSS("opacity", "1");
  const more = yaml.nth(0).locator(".mdmark-code-fold-more");
  await expect(more).toHaveText("⋯");
  // 実行: ⋯ を押す
  await more.click();
  // 検証
  expect(await visibleLines(yaml)).toEqual([true, true, true, true, true]);
  await expect(first).toHaveAttribute("aria-expanded", "true");
  // 実行: Shift を押しながら畳み、Shift を押しながら開く
  await first.click({ modifiers: ["Shift"] });
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "false");
  await first.click({ modifiers: ["Shift"] });
  // 検証: 内側も畳んだまま残らない
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(second).toHaveAttribute("aria-expanded", "true");
  expect(await visibleLines(yaml)).toEqual([true, true, true, true, true]);
  // 実行・検証: キーボードで操作する
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  // 実行: json のオブジェクトの行を畳む
  const json = blockLines(page, 1);
  await foldButton(json.nth(1)).click();
  // 検証: 閉じ括弧の行は出ている
  expect(await visibleLines(json)).toEqual([true, true, false, true, true]);
  await expect(json.nth(3)).toContainText("}");
  // 検証: tree のコードブロックには開閉のボタンが無い
  await expect(page.locator("#doc .mdmark-tree .mdmark-code-fold")).toHaveCount(
    0,
  );
});

// インデントの 1 レベルごとに縦線を描き、ポインターを乗せた行のブロックの縦線だけを濃くする（正常シナリオ（インデントの縦線））
test("test_normal_when_indent_guides", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: FOLD_MARKDOWN,
    config: { features: { syntax: false } },
  });
  const yaml = blockLines(page, 0);
  // 検証: インデントのレベルの数の縦線
  for (const index of [1, 2, 3]) {
    const line = yaml.nth(index);
    const level = await line.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--mdmark-code-level").trim(),
    );
    expect(level).toBe(await line.getAttribute("data-indent"));
    expect(Number(level)).toBeGreaterThan(0);
  }
  // 実行: 2 行目のブロックの行にポインターを乗せる
  await yaml.nth(2).locator(".mdmark-code-text").hover();
  // 検証: そのブロックの縦線だけが濃い
  const active = await yaml.evaluateAll((elements) =>
    elements.map((element) => element.hasAttribute("data-guide-active")),
  );
  expect(active).toEqual([false, false, true, false, false]);
  // 実行: コードブロックの文字を全て選ぶ
  const selected = await selectedCode(page);
  // 検証
  expect(selected).toContain("    c: 1");
  expect(selected).not.toMatch(/[│┃]/);
});

/** 2 行目と 6 行目が畳める行の 8 行の yaml を、`fold=2,6` で畳んで描く文書 */
const FOLD_OPTION_MARKDOWN = [
  '<!-- code: {"lines": {}, "fold": [2, 6]} -->',
  "",
  "```yaml",
  "root:",
  "  a:",
  "    b: 1",
  "  c: 2",
  "other:",
  "  d:",
  "    e: 3",
  "  f: 4",
  "```",
  "",
].join("\n");

// `fold=` の行を畳んで描き、畳んだ行を含めてコピーし、再読み込みすると `fold=` のとおりに畳む（正常シナリオ（最初から畳む行を指定する））
test("test_normal_when_fold_option", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  const mount = () =>
    mountDocument(page, {
      markdown: FOLD_OPTION_MARKDOWN,
      config: { features: { syntax: false } },
    });
  await mount();
  const lines = blockLines(page, 0);
  // 検証: 2 行目と 6 行目を畳んで描く
  const expectFolded = async () => {
    expect(await visibleLines(lines)).toEqual([
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
    ]);
    for (const index of [1, 5]) {
      await expect(foldButton(lines.nth(index))).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(
        lines.nth(index).locator(".mdmark-code-fold-more"),
      ).toHaveText("⋯");
    }
  };
  await expectFolded();
  // 実行: コピーボタンを押す
  await page.locator("#doc button.mdmark-code-copy").click();
  // 検証: 畳んだ行を含む全ての行
  await expect
    .poll(() => writtenTexts(page))
    .toEqual(["root:\n  a:\n    b: 1\n  c: 2\nother:\n  d:\n    e: 3\n  f: 4"]);
  // 実行: 2 行目を開き、ページを再読み込みする
  await foldButton(lines.nth(1)).click();
  await expect(foldButton(lines.nth(1))).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.reload();
  await page.waitForFunction(() => "mdmark" in window);
  await mount();
  // 検証: 開閉の状態は覚えておらず、`fold=` のとおりに畳む
  await expectFolded();
});

// 畳めない行とコードブロックに無い行の `fold=` は記載の警告にし、畳める行だけを畳む（異常シナリオ（畳めない行の fold=））
test("test_error_when_fold_line_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- code: {"fold": [1, 3, 99]} -->',
      "",
      "```yaml",
      "a:",
      "  b: 1",
      "c: 2",
      "d: 3",
      "e: 4",
      "```",
      "",
    ].join("\n"),
    config: { features: { syntax: false } },
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("3 行目");
  await expect(warning).toContainText("99");
  const lines = blockLines(page, 0);
  await expect(foldButton(lines.nth(0))).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(await visibleLines(lines)).toEqual([true, false, true, true, true]);
  for (const text of ["a:", "c: 2", "d: 3", "e: 4"]) {
    await expect(page.locator("#doc pre code")).toContainText(text);
  }
  await expect(page.locator("#doc pre code")).toContainText("b: 1");
});

/** 画面の幅 390px で表示の幅より長い行 */
const WRAP_LONG_LINE =
  'const url = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.10.0/dist/index.js"; // バージョンを固定した URL から配布物を読む';

// wrap のブロックだけを枠の幅で折り返し、行番号を各行の頭に出し、コピーに折り返しの改行を入れない（正常シナリオ（折り返す））
test("test_normal_when_wrap", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  const code = ["```ts", "const a = 1;", WRAP_LONG_LINE, "const c = 3;", "```"];
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- code: {"lines": {}, "wrap": true} -->',
      "",
      ...code,
      "",
      ...code,
      "",
    ].join("\n"),
  });
  // 検証
  const [wrapped, plain] = [
    page.locator("#doc .mdmark-code pre").nth(0),
    page.locator("#doc .mdmark-code pre").nth(1),
  ];
  const measured = await wrapped.evaluate((pre) => {
    const lines = [...pre.querySelectorAll(".mdmark-code-line")];
    return {
      fits: pre.scrollWidth <= pre.clientWidth,
      numbers: lines.map((line) => line.getAttribute("data-line")),
      heights: lines.map((line) => line.getBoundingClientRect().height),
      numberTop: getComputedStyle(lines[2] as Element, "::before").top,
    };
  });
  expect(measured.fits).toBe(true);
  expect(measured.numbers).toEqual(["1", "2", "3"]);
  const [first = 0, second = 0] = measured.heights;
  expect(second).toBeGreaterThanOrEqual(first * 2);
  expect(measured.numberTop).toBe("0px");
  expect(await plain.evaluate((pre) => pre.scrollWidth > pre.clientWidth)).toBe(
    true,
  );
  // 実行・検証: wrap のブロックのコピーは折り返しの改行を含まない
  await page
    .locator("#doc .mdmark-code")
    .nth(0)
    .locator("button.mdmark-code-copy")
    .click();
  await expect
    .poll(() => writtenTexts(page))
    .toEqual([["const a = 1;", WRAP_LONG_LINE, "const c = 3;"].join("\n")]);
});
