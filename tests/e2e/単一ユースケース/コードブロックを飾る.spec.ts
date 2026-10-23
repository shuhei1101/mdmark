import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
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
  await expect(doc.locator(".mdmark-code-title")).toHaveText("app.ts");
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
  await expect(doc.locator(".mdmark-code-title")).toHaveText("app.ts");
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
