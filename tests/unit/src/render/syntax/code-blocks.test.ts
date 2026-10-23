import { expect, test } from "vitest";
import type { WarningItem } from "../../../../../src/extensions.ts";
import { parseMarkArgs } from "../../../../../src/render/marks.ts";
import { findTag, matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** コードブロックの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCodeBlocks = () =>
  import("../../../../../src/render/syntax/code-blocks.ts");

/** 警告の項目の見出しと本文をつなげた文字 */
const warningText = (warnings: WarningItem[]): string =>
  warnings.map((item) => `${item.label} ${item.message}`).join("\n");

// 題・行番号・行と範囲の強調を読む（正常系）
test("test_read_code_spec", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  const args = parseMarkArgs("title=app.ts lines highlight=2,4-6");
  // 実行
  const spec = readCodeSpec({ args, lineCount: 6 });
  // 検証
  expect(spec.title).toBe("app.ts");
  expect(spec.lineNumbers).toBe(true);
  expect([...spec.highlights]).toEqual([2, 4, 5, 6]);
  expect(spec.warnings).toEqual([]);
});

// 知らないキーと空白の後ろの指定を警告にし、読めた題を当てる（異常系）
test("test_read_code_spec_when_unknown_key", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  const args = parseMarkArgs("title=My App.ts color=red");
  // 実行
  const spec = readCodeSpec({ args, lineCount: 3 });
  // 検証
  expect(spec.title).toBe("My");
  const text = warningText(spec.warnings);
  expect(text).toContain("App.ts");
  expect(text).toContain("color=");
});

// 行の数を超える番号と読めない番号を外して警告にする（異常系）
test("test_read_code_spec_when_line_missing", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  const args = parseMarkArgs("highlight=2,5,x,3-1");
  // 実行
  const spec = readCodeSpec({ args, lineCount: 3 });
  // 検証
  expect([...spec.highlights]).toEqual([2]);
  const text = warningText(spec.warnings);
  expect(text).toContain("5");
  expect(text).toContain("x");
  expect(text).toContain("3-1");
});

// 印と印だけの行コメントの頭と行末の空白を外す（正常系）
test("test_read_line_marks", async () => {
  // 準備
  const { readLineMarks } = await loadCodeBlocks();
  const source = [
    "let count = 1; // [!code ++]",
    "foo(); // 消す [!code --]",
    "x = 1  # [!code highlight]",
    "<p>a</p> <!-- [!code ++] -->",
    "a; /* [!code --] */",
    "foo();// [!code ++]",
    "i-- [!code ++]",
  ].join("\n");
  // 実行
  const { lines, warnings } = readLineMarks(source);
  // 検証
  expect(lines).toEqual([
    { text: "let count = 1;", kind: "add" },
    { text: "foo(); // 消す", kind: "del" },
    { text: "x = 1", kind: "highlight" },
    { text: "<p>a</p>", kind: "add" },
    { text: "a;", kind: "del" },
    { text: "foo();", kind: "add" },
    { text: "i--", kind: "add" },
  ]);
  expect(warnings).toEqual([]);
});

// 打ち消した印は `\` を外した文字にして当てない（正常系）
test("test_read_line_marks_when_escaped", async () => {
  // 準備
  const { readLineMarks } = await loadCodeBlocks();
  const source = "let count = 1; // [\\!code ++]";
  // 実行
  const { lines, warnings } = readLineMarks(source);
  // 検証
  expect(lines).toEqual([{ text: "let count = 1; // [!code ++]" }]);
  expect(lines[0]).not.toHaveProperty("kind");
  expect(warnings).toEqual([]);
});

// 知らない印は当てずに警告にする（異常系）
test("test_read_line_marks_when_unknown", async () => {
  // 準備
  const { readLineMarks } = await loadCodeBlocks();
  const source = "foo(); // [!code focus]";
  // 実行
  const { lines, warnings } = readLineMarks(source);
  // 検証
  expect(lines).toEqual([{ text: "foo(); // [!code focus]" }]);
  expect(lines[0]).not.toHaveProperty("kind");
  expect(warnings).toHaveLength(1);
  expect(warningText(warnings)).toContain("[!code focus]");
});

// 印と行の印を持つコードブロックを部品にし、何も持たないコードブロックは `fence` のままにする（正常系）
test("test_build_code_blocks", () => {
  // 準備
  const markdown = [
    "<!-- code: title=app.ts lines -->",
    "",
    "```ts",
    "const a = 1;",
    "const b = 2;",
    "```",
    "",
    "```ts",
    "const plain = true;",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<figure class="mdmark-code"');
  expect(html).toContain("app.ts</figcaption>");
  expect(matches(html, /<pre/g)).toHaveLength(2);
  expect(matches(html, /mdmark-code-lines/g)).toHaveLength(1);
  expect(html.lastIndexOf("<pre")).toBeGreaterThan(html.indexOf("</figure>"));
  expect(html).not.toContain("<!--");
});

// 打ち消した印だけのコードブロックは `fence` のまま `\` を外した中身にする（正常系）
test("test_build_code_blocks_when_escaped", () => {
  // 準備
  const markdown = ["```ts", "let count = 1; // [\\!code ++]", "```", ""].join(
    "\n",
  );
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("let count = 1; // [!code ++]");
  expect(html).not.toContain("\\!code");
  expect(html).not.toContain("mdmark-code-lines");
  expect(html).not.toContain("<figure");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 知らない印だけのコードブロックの前に警告を差し込む（異常系）
test("test_build_code_blocks_when_unknown_line_mark", () => {
  // 準備
  const markdown = ["```ts", "foo(); // [!code focus]", "```", ""].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = html.indexOf("mdmark-syntax-warning");
  expect(warning).toBeGreaterThanOrEqual(0);
  expect(html.indexOf("[!code focus]")).toBeGreaterThan(warning);
  const pre = html.indexOf("<pre");
  expect(pre).toBeGreaterThan(warning);
  expect(html.indexOf("foo(); // [!code focus]", pre)).toBeGreaterThan(pre);
  expect(html).not.toContain("mdmark-code-lines");
});

// 後ろにコードブロックの無い印を警告にする（異常系）
test("test_build_code_blocks_when_no_fence", () => {
  // 準備
  const markdown = ["<!-- code: title=app.ts -->", "", "段落", ""].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("<p>段落</p>");
  expect(html).not.toContain("<figcaption");
  expect(html).not.toContain("<!--");
});

// `code` がオフなら何もしない（正常系）
test("test_build_code_blocks_when_disabled", () => {
  // 準備
  const markdown = ["```ts", "let count = 1; // [!code ++]", "```", ""].join(
    "\n",
  );
  // 実行
  const { html: on } = renderDoc(markdown);
  const { html: off } = renderDoc(markdown, { code: false });
  // 検証
  expect(on).toContain("mdmark-code-lines");
  expect(findTag(off, "<pre")).not.toContain("mdmark-code-lines");
  expect(off).not.toContain("mdmark-code-lines");
  expect(off).toContain("let count = 1; // [!code ++]");
});
