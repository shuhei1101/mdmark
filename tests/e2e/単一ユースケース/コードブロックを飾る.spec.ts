import { expect, type Page, test } from "@playwright/test";
import { stubClipboard, writtenTexts } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeSyntax,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 3 行の言語 `ts` のコードブロック
const THREE_LINES = [
  "```ts",
  "const a = 1;",
  "const b = 2;",
  "const c = 3;",
  "```",
];

// 色分けする言語（`ts`・`yaml`・`python`）のコードブロックを 1 つずつ置いた文書
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

// 色分けのライブラリを読み終えるのを待つ時間の上限、読まないことを確かめるために待つ時間（ミリ秒）
const SETTLE_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** コードブロックの文字を全て選び、選んだ文字を返す */
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

// 題・行番号・行の強調を付け、行番号は選んで写す文字に入らない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- code: title=app.ts lines highlight=2 -->",
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

// 行末の印で行に種類を付け、印と印だけの行コメントの頭を外す（正常シナリオ（コードの行の印））
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

// 打ち消した印は、`\` を外した文字のまま出す（正常シナリオ（印の書き方を見せる））
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

// 機能をオフにした文書は、題・行番号・行の強調を付けず、行の印を書いた文字のまま出す（正常シナリオ（機能をオフにした文書））
test("test_normal_when_feature_off", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- features: -code -->",
      "",
      "<!-- code: title=app.ts lines highlight=2 -->",
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

// 知らないキーは当てずに警告にし、読めた題を付ける（異常シナリオ（読めない指定））
test("test_error_when_unknown_key", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- code: title=app.ts color=red -->",
      "",
      ...THREE_LINES,
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  const warning = doc.locator(".mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("書き方の警告");
  await expect(warning).toContainText("color=");
  for (const key of ["title=", "lines", "highlight="]) {
    await expect(warning).toContainText(key);
  }
  await expect(doc.locator(".mdmark-code-title")).toContainText("app.ts");
  const order = await doc.evaluate((element) => {
    const box = element.querySelector(".mdmark-syntax-warning");
    const code = element.querySelector(".mdmark-code");
    return box && code
      ? Boolean(
          box.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING,
        )
      : false;
  });
  expect(order).toBe(true);
});

// コードブロックに無い行の番号は当てずに警告にし、ある行だけを強調する（異常シナリオ（コードブロックに無い行の番号））
test("test_error_when_highlight_line_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ["<!-- code: highlight=2,5 -->", "", ...THREE_LINES, ""].join(
      "\n",
    ),
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

// 知らないコードの行の印は当てずに警告にし、書いた文字のまま出す（異常シナリオ（知らないコードの行の印））
test("test_error_when_unknown_line_mark", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ["```ts", "foo(); // [!code focus]", "```", ""].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  const warning = doc.locator(".mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("[!code focus]");
  for (const mark of ["[!code ++]", "[!code --]", "[!code highlight]"]) {
    await expect(warning).toContainText(mark);
  }
  await expect(doc.locator("pre")).toContainText("foo(); // [!code focus]");
  await expect(doc.locator(".mdmark-code-line")).toHaveCount(0);
});

// 印の後にコードブロックが無いときは警告にし、段落をそのまま出す（異常シナリオ（印の後にコードブロックが無い））
test("test_error_when_no_code_block", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ["<!-- code: title=app.ts -->", "", "直後の段落", ""].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  const warning = doc.locator(".mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("直後にコードブロックがありません");
  await expect(doc.locator("p", { hasText: "直後の段落" })).toBeVisible();
  await expect(doc.locator(".mdmark-code-title")).toHaveCount(0);
});

/** 開いたページの `console.error` の文字を控え、控えた文字を返す関数を返す */
function collectConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return () => errors;
}

/** `#doc` の色の変数 `name` が今の配色で指す色（`rgb(…)`）を返す */
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

/** コードブロックごとに、`hljs-` で始まる class の `span` の数を返す */
async function coloredSpanCounts(page: Page): Promise<number[]> {
  return await page
    .locator("#doc pre code")
    .evaluateAll((codes) =>
      codes.map((code) => code.querySelectorAll('span[class*="hljs-"]').length),
    );
}

/** コードブロックごとに、文字を全て選んだときの選んだ文字を返す */
async function selectedTexts(page: Page): Promise<string[]> {
  return await page.locator("#doc pre").evaluateAll((pres) =>
    pres.map((pre) => {
      const selection = window.getSelection();
      selection?.selectAllChildren(pre);
      return (selection?.toString() ?? "").trim();
    }),
  );
}

// 言語に応じてコードブロックを色分けし、文字は書いたとおりで、本体と使う言語のモジュールだけを読む（正常シナリオ（言語に応じて色分けする））
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
  // 文字は書いたとおりで、全て選んで写した文字が色分けの前と同じ
  expect(await selectedTexts(page)).toEqual(HIGHLIGHT_TEXTS);
  // 本体と、文書が使う言語のモジュールを 1 件ずつ読む
  expect(requests()).toEqual([
    "core.min.js",
    "languages/python.min.js",
    "languages/typescript.min.js",
    "languages/yaml.min.js",
  ]);
});

// 題・行番号・コードの行の印を保ったまま、行ごとに中身を色分けする（正常シナリオ（題・行番号・コードの行の印と色分けする））
test("test_normal_when_highlighted_with_line_marks", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- code: title=app.ts lines highlight=4 -->",
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
  // 消した行・足した行が、それぞれの地の色と行頭の印で出ていて、行の中の文字は色分けされている
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
  // 全て選んだ文字に、行番号と行頭の印が入らず、印の文字も出ない
  const copied = (await selectedTexts(page))[0] ?? "";
  expect(copied).not.toMatch(/^\d/m);
  expect(copied).not.toMatch(/^[+-]/m);
  expect(copied).not.toContain("[!code");
});

// 言語の無いコードブロックと、色分けしない言語のコードブロックは、書いたとおりに出し、ライブラリを読まない（正常シナリオ（色分けしない言語））
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

// 色分けの機能をオフにした文書は、色分けせず、行の印を付けたコードブロックをそのまま描く（正常シナリオ（色分けの機能をオフにした文書））
test("test_normal_when_syntax_feature_off", async ({ page }) => {
  // 準備
  const requests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- features: -syntax -->",
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

// 色分けのライブラリの本体を読めないとき、コードブロックを色分けせずに欠けずに出し、知らせの枠は出さずにコンソールへ出す（異常シナリオ（色分けのライブラリを読めない））
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

// 言語のモジュールの一部を読めないとき、読めた言語のコードブロックだけを色分けし、読めなかった言語はコンソールへ出す（異常シナリオ（言語のモジュールの一部を読めない））
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

// 言語の指定があるコードブロックの上の帯の左端に言語のラベルを出し、選んだ文字に入れず、読み上げの名前は変えない（正常シナリオ（言語のラベルを出す））
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
  // 検証: 読み上げの名前は今のまま
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

// コピーボタンで、消した行を含めない変更後のコードをコピーし、ボタンで知らせ、しばらくすると元に戻す（正常シナリオ（変更後のコードをコピーする））
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
  // 検証: 消した行と印、行番号と行頭の `+`・`-` を含まない変更後のコードをコピーする
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

// 色分けのライブラリを `dockerfile`・`diff` の言語のモジュールまで読み、別名のコードブロックも色分けし、足した行の印と両立する（正常シナリオ（Dockerfile と diff を色分けする））
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
  // `[!code ++]` を付けた行が足した行の地の色と行頭の `+` で出ていて、行の中の文字は色分けされている
  const marked = page.locator(
    '#doc code.language-diff .mdmark-code-line[data-kind="add"]',
  );
  await expect(marked).toHaveCount(1);
  expect(await hasBackground(marked)).toBe(true);
  expect(
    await marked.evaluate((el) => getComputedStyle(el, "::after").content),
  ).toContain("+");
  await expect(marked.locator("span[class*='hljs-']")).not.toHaveCount(0);
  // 各コードブロックのラベルは書いた情報文字列のとおり
  await expect(page.locator("#doc .mdmark-code-lang-name")).toHaveText([
    "dockerfile",
    "docker",
    "diff",
    "patch",
  ]);
});

// クリップボードへの書き込みが拒まれたら、ボタンで知らせ、コードブロックの文字は選んで手でコピーできる（異常シナリオ（クリップボードに書けない））
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
  // 検証: ボタンと読み上げで、コピーできなかったことが知らされる
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
