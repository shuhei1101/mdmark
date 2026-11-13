import { expect, test } from "vitest";
import type { WarningItem } from "../../../../../src/extensions.ts";
import {
  findTag,
  findTags,
  innerHtml,
  matches,
} from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** コードブロックの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCodeBlocks = () =>
  import("../../../../../src/render/syntax/code-blocks.ts");

/** 警告の項目の見出しと本文をつなげた文字 */
const warningText = (warnings: WarningItem[]): string =>
  warnings.map((item) => `${item.label} ${item.message}`).join("\n");

// タイトル・行番号・行と範囲の強調を読み込む（正常系）
test("test_read_code_spec", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  const options = {
    title: "My App.ts",
    lines: {},
    highlight: [2, { from: 4, to: 6 }],
  };
  // 実行
  const spec = readCodeSpec({ options, lineCount: 6 });
  // 検証
  expect(spec.title).toBe("My App.ts");
  expect(spec.lineNumbers).toBe(true);
  expect(spec.lineStart).toBe(1);
  expect([...spec.highlights]).toEqual([2, 4, 5, 6]);
  expect(spec.warnings).toEqual([]);
});

// 行に無い番号と逆の範囲を削除して警告にする（異常系）
test("test_read_code_spec_when_line_missing", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  const options = { highlight: [2, 5, { from: 3, to: 1 }] };
  // 実行
  const spec = readCodeSpec({ options, lineCount: 3 });
  // 検証
  expect([...spec.highlights]).toEqual([2]);
  const text = JSON.stringify(spec.warnings);
  expect(spec.warnings).toHaveLength(2);
  expect(text).toContain("5");
  expect(text).toContain("to");
});

// マーカーとマーカーだけの行コメントの頭と行末の空白を削除する（正常系）
test("test_read_line_marks", async () => {
  // 準備
  const { readLineMarks } = await loadCodeBlocks();
  const source = [
    "let count = 1; // [!code ++]",
    "foo(); // 削除する [!code --]",
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
    { text: "foo(); // 削除する", kind: "del" },
    { text: "x = 1", kind: "highlight" },
    { text: "<p>a</p>", kind: "add" },
    { text: "a;", kind: "del" },
    { text: "foo();", kind: "add" },
    { text: "i--", kind: "add" },
  ]);
  expect(warnings).toEqual([]);
});

// 打ち消したマーカーは `\` を削除した文字にして適用しない（正常系）
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

// 知らないマーカーは当てずに警告にする（異常系）
test("test_read_line_marks_when_unknown", async () => {
  // 準備
  const { readLineMarks } = await loadCodeBlocks();
  const source = "foo(); // [!code blink]";
  // 実行
  const { lines, warnings } = readLineMarks(source);
  // 検証
  expect(lines).toEqual([{ text: "foo(); // [!code blink]" }]);
  expect(lines[0]).not.toHaveProperty("kind");
  expect(warnings).toHaveLength(1);
  expect(warningText(warnings)).toContain("[!code blink]");
});

// マーカーと行のマーカーを持つコードブロックも何も持たないコードブロックも帯を持つ部品にする（正常系）
test("test_build_code_blocks", () => {
  // 準備
  const markdown = [
    '<!-- code: {"title": "app.ts", "lines": {}} -->',
    "",
    "```ts",
    "const a = 1;",
    "const b = 2;",
    "```",
    "",
    "```text",
    "const plain = true;",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, { syntax: false });
  // 検証: タイトルを持つ 1 つ目は figure と figcaption の帯で、言語のラベルがタイトルの前にある
  expect(html).toContain('<figure class="mdmark-code"');
  expect(html).toContain(
    '<figcaption class="mdmark-code-title mdmark-code-bar">',
  );
  const caption = innerHtml(html, "mdmark-code-title");
  expect(caption).toContain(
    '<span class="mdmark-code-lang-name" aria-hidden="true">ts</span>',
  );
  expect(caption.indexOf("mdmark-code-lang")).toBeLessThan(
    caption.indexOf("app.ts"),
  );
  // 検証: タイトルを持たない 2 つ目は div の帯で、言語のラベルが text
  expect(html).toContain(
    '<div class="mdmark-code"><div class="mdmark-code-bar">',
  );
  expect(html).toContain(
    '<span class="mdmark-code-lang-name" aria-hidden="true">text</span>',
  );
  // 検証: コピーのボタンは mount が付けるため、文字列に無い
  expect(html).not.toContain("mdmark-code-copy");
  expect(matches(html, /<pre/g)).toHaveLength(2);
  expect(matches(html, /mdmark-code-lines/g)).toHaveLength(1);
  expect(html.lastIndexOf("<pre")).toBeGreaterThan(html.indexOf("</figure>"));
  expect(html).not.toContain("<!--");
});

// 情報文字列の `言語:ファイル名` を言語のラベルとファイル名とスクリーンリーダー向けの名前に分ける（正常系）
test("test_build_code_blocks_when_file_name", () => {
  // 準備
  const markdown = [
    "```python:hoge.py",
    "def hello(): pass",
    "```",
    "",
    "```:a.txt",
    "x",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 1 つ目は言語とファイル名のラベル、`code` の class、ファイル名のスクリーンリーダー向けの名前を持つ
  const [firstPre, secondPre] = findTags(html, "<pre");
  const [firstCode, secondCode] = findTags(html, "<code");
  expect(html).toContain(
    '<span class="mdmark-code-lang-name" aria-hidden="true">python</span>',
  );
  expect(html).toContain('<span class="mdmark-code-file">hoge.py</span>');
  expect(firstCode).toContain('class="language-python"');
  expect(firstPre).toContain('aria-label="コード: hoge.py"');
  // 検証: 2 つ目は言語のラベルを持たず、`code` が class を持たず、スクリーンリーダー向けの名前が `コード`
  expect(matches(html, /class="mdmark-code-lang"/g)).toHaveLength(1);
  expect(secondCode).not.toContain("class=");
  expect(secondPre).toContain('aria-label="コード"');
});

// `tree:src` はファイルツリーにせず普通のコードブロックにする（正常系）
test("test_build_code_blocks_when_tree_with_file_name", () => {
  // 準備
  const markdown = [
    "```tree:src",
    "mdmark/",
    "├── src/",
    "└── package.json",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-tree");
  expect(html).toContain(
    '<span class="mdmark-code-lang-name" aria-hidden="true">tree</span>',
  );
  expect(html).toContain('<span class="mdmark-code-file">src</span>');
});

// 打ち消したマーカーは `\` を削除した文字の行にする（正常系）
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
  expect(html).not.toContain("mdmark-code-line ");
  expect(html).not.toContain("<figure");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 知らないマーカーだけのコードブロックの前に警告を差し込む（異常系）
test("test_build_code_blocks_when_unknown_line_mark", () => {
  // 準備
  const markdown = ["```ts", "foo(); // [!code blink]", "```", ""].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = html.indexOf("mdmark-syntax-warning");
  expect(warning).toBeGreaterThanOrEqual(0);
  expect(html.indexOf("[!code blink]")).toBeGreaterThan(warning);
  expect(html.indexOf("mdmark-code-bar")).toBeGreaterThan(warning);
  const pre = html.indexOf("<pre");
  expect(pre).toBeGreaterThan(warning);
  expect(html.indexOf("foo(); // [!code blink]", pre)).toBeGreaterThan(pre);
  expect(html).not.toContain("mdmark-code-lines");
});

// 後ろにコードブロックの無いマーカーを警告にする（異常系）
test("test_build_code_blocks_when_no_fence", () => {
  // 準備
  const markdown = ['<!-- code: {"title": "app.ts"} -->', "", "段落", ""].join(
    "\n",
  );
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("<p>段落</p>");
  expect(html).not.toContain("<figcaption");
  expect(html).not.toContain("<!--");
});

// `code` も `syntax` もオフなら `fence` のまま、情報文字列を言語だけにする（正常系）
test("test_build_code_blocks_when_disabled", () => {
  // 準備
  const markdown = [
    "```ts:app.ts",
    "let count = 1; // [!code ++]",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html: on } = renderDoc(markdown);
  const { html: off } = renderDoc(markdown, { code: false, syntax: false });
  // 検証
  expect(on).toContain("mdmark-code-lines");
  expect(on).toContain("mdmark-code-bar");
  expect(findTag(off, "<pre")).not.toContain("mdmark-code-lines");
  expect(off).not.toContain("mdmark-code-lines");
  expect(off).not.toContain("mdmark-code-bar");
  expect(findTag(off, "<code")).toContain('class="language-ts"');
  expect(off).not.toContain("language-ts:app.ts");
  expect(off).toContain("let count = 1; // [!code ++]");
});

// 色分けの対象に色分けの属性を付け、対象外には付けない（正常系）
test("test_build_code_blocks_when_syntax", () => {
  // 準備
  const markdown = [
    "```yml",
    "a: 1",
    "```",
    "",
    "```text",
    "plain",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: どちらも帯を持つ部品で、色分けの属性は 1 つ目だけにある
  expect(html).toContain(
    '<code class="language-yml" data-mdmark-syntax="yaml">',
  );
  expect(matches(html, /data-mdmark-syntax/g)).toHaveLength(1);
  expect(findTag(html, "language-text")).not.toContain("data-mdmark-syntax");
  expect(matches(html, /<div class="mdmark-code-bar">/g)).toHaveLength(2);
});

// `syntax` がオフなら色分けの属性を付けない（正常系）
test("test_build_code_blocks_when_syntax_disabled", () => {
  // 準備
  const markdown = [
    '<!-- features: {"syntax": false} -->',
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
    '<!-- code: {"lines": {}} -->',
    "",
    "```ts",
    "const b = 2;",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 1 つ目は帯を持つ部品、2 つ目は行番号を持つ部品
  expect(html).not.toContain("data-mdmark-syntax");
  expect(matches(html, /mdmark-code-bar/g)).toHaveLength(2);
  expect(matches(html, /mdmark-code-numbered/g)).toHaveLength(1);
  expect(matches(html, /mdmark-code-lines/g)).toHaveLength(1);
});

// `code` がオフでも `syntax` がオンなら、行のマーカーを削除せず帯を持たない部品で色分けの属性を付ける（正常系）
test("test_build_code_blocks_when_code_disabled_with_syntax", () => {
  // 準備
  const markdown = [
    "```ts:app.ts",
    "let count = 1; // [!code ++]",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, { code: false });
  // 検証
  expect(html).toContain(
    '<code class="language-ts" data-mdmark-syntax="typescript">',
  );
  expect(html).not.toContain("mdmark-code-bar");
  expect(html).not.toContain("mdmark-code-lines");
  expect(html).toContain("let count = 1; // [!code ++]");
});

// dockerfile・diff と別名を色分けの言語に参照する（正常系）
test("test_build_code_blocks_when_dockerfile_and_diff", () => {
  // 準備
  const markdown = ["dockerfile", "docker", "diff", "patch"]
    .map((language) => `\`\`\`${language}\nx\n\`\`\`\n`)
    .join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const languages = matches(html, /data-mdmark-syntax="([^"]*)"/g).map(
    (attribute) => /"([^"]*)"/.exec(attribute)?.[1],
  );
  expect(languages).toEqual(["dockerfile", "dockerfile", "diff", "diff"]);
});

// mermaid のコードブロックに mermaid の対象の属性を付け、色分けの対象にしない（正常系）
test("test_build_code_blocks_when_mermaid", () => {
  // 準備
  const markdown = [
    "```mermaid",
    "flowchart LR",
    "```",
    "",
    "```mermaid:a.mmd",
    "flowchart LR",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 1 つ目だけが mermaid の対象で、どちらも色分けの対象でない
  expect(matches(html, /data-mdmark-mermaid/g)).toHaveLength(1);
  expect(findTag(html, "data-mdmark-mermaid")).toContain('class="mdmark-code"');
  expect(html).toContain('<code class="language-mermaid">');
  expect(html).not.toContain("data-mdmark-syntax");
  expect(matches(html, /<div class="mdmark-code-bar">/g)).toHaveLength(2);
});

// mermaid がオフなら、ほかの言語と同じコードブロックにする（正常系）
test("test_build_code_blocks_when_mermaid_disabled", () => {
  // 準備
  const markdown = [
    '<!-- features: {"mermaid": false} -->',
    "",
    "```mermaid",
    "flowchart LR",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<div class="mdmark-code-bar">');
  expect(html).not.toContain("data-mdmark-mermaid");
});

// code がオフでも mermaid のコードブロックは帯を持たない部品にして属性を付ける（正常系）
test("test_build_code_blocks_when_mermaid_without_code", () => {
  // 準備
  const markdown = ["```mermaid", "flowchart LR", "```", ""].join("\n");
  // 実行
  const { html } = renderDoc(markdown, { code: false });
  // 検証
  expect(html).toContain("<pre data-mdmark-mermaid");
  expect(html).not.toContain("mdmark-code-bar");
});

// 別名と大文字を表のモジュール名にする（正常系）
test("test_syntax_language_of", async () => {
  // 準備
  const { syntaxLanguageOf } = await loadCodeBlocks();
  // 実行
  const result = ["ts", "YML", "html"].map((language) =>
    syntaxLanguageOf(language),
  );
  // 検証
  expect(result).toEqual(["typescript", "yaml", "xml"]);
});

// dockerfile・diff と別名を参照する（正常系）
test("test_syntax_language_of_when_dockerfile_and_diff", async () => {
  // 準備
  const { syntaxLanguageOf } = await loadCodeBlocks();
  // 実行
  const result = ["Dockerfile", "docker", "diff", "patch"].map((language) =>
    syntaxLanguageOf(language),
  );
  // 検証
  expect(result).toEqual(["dockerfile", "dockerfile", "diff", "diff"]);
});

// 表に無い単語と継承した名前は参照しない（正常系）
test("test_syntax_language_of_when_unknown", async () => {
  // 準備
  const { syntaxLanguageOf } = await loadCodeBlocks();
  // 実行
  const result = ["text", "tree", "", "constructor"].map((language) =>
    syntaxLanguageOf(language),
  );
  // 検証
  expect(result).toEqual([undefined, undefined, undefined, undefined]);
});

// 最初の `:` で言語とファイル名に分ける（正常系）
test("test_split_info_string", async () => {
  // 準備
  const { splitInfoString } = await loadCodeBlocks();
  // 実行
  const result = [
    "python:hoge.py",
    "ts:src/app.ts",
    "ts",
    "a:b:c.txt",
    "ts:app.ts extra",
  ].map((info) => splitInfoString(info));
  // 検証
  expect(result).toEqual([
    { language: "python", fileName: "hoge.py" },
    { language: "ts", fileName: "src/app.ts" },
    { language: "ts", fileName: "" },
    { language: "a", fileName: "b:c.txt" },
    { language: "ts", fileName: "app.ts" },
  ]);
});

// 空と `:` の前が空のときは言語もファイル名も持たない（正常系）
test("test_split_info_string_when_no_language", async () => {
  // 準備
  const { splitInfoString } = await loadCodeBlocks();
  // 実行
  const result = ["", ":a.txt"].map((info) => splitInfoString(info));
  // 検証
  expect(result).toEqual([
    { language: "", fileName: "" },
    { language: "", fileName: "" },
  ]);
});

// 最初から畳む行を読み取り、無い行を警告にする（正常系）
test("test_read_code_spec_when_fold", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  const options = { fold: [2, { from: 4, to: 5 }, 99] };
  // 実行
  const spec = readCodeSpec({ options, lineCount: 6 });
  // 検証
  expect([...spec.folds]).toEqual([2, 4, 5]);
  expect(spec.warnings).toHaveLength(1);
  expect(JSON.stringify(spec.warnings)).toContain("99");
});

// focus・error・warning を行の種類にする（正常系）
test("test_read_line_marks_when_focus_error_warning", async () => {
  // 準備
  const { readLineMarks } = await loadCodeBlocks();
  const source = [
    "a(); // [!code focus]",
    "b(); # [!code error]",
    "c(); /* [!code warning] */",
  ].join("\n");
  // 実行
  const { lines, warnings } = readLineMarks(source);
  // 検証
  expect(lines).toEqual([
    { text: "a();", kind: "focus" },
    { text: "b();", kind: "error" },
    { text: "c();", kind: "warning" },
  ]);
  expect(warnings).toEqual([]);
});

// インデントと畳む行を付け、指定の行を畳んだ状態にする（正常系）
test("test_read_folds", async () => {
  // 準備
  const { readFolds } = await loadCodeBlocks();
  const lines = [
    { text: "a:" },
    { text: "  b:" },
    { text: "    c: 1" },
    { text: "  d: 2" },
  ];
  // 実行
  const read = readFolds({ lines, folds: new Set([2]) });
  // 検証
  expect(read.lines.map((line) => line.indent ?? 0)).toEqual([0, 1, 2, 1]);
  expect(read.lines.map((line) => line.foldLines)).toEqual([
    3,
    1,
    undefined,
    undefined,
  ]);
  expect(read.lines.map((line) => line.folded === true)).toEqual([
    false,
    true,
    false,
    false,
  ]);
  expect(read.warnings).toEqual([]);
});

// 畳めない行を警告にする（異常系）
test("test_read_folds_when_not_foldable", async () => {
  // 準備
  const { readFolds } = await loadCodeBlocks();
  const lines = [{ text: "a:" }, { text: "  b: 1" }, { text: "c: 2" }];
  // 実行
  const read = readFolds({ lines, folds: new Set([2, 3]) });
  // 検証
  expect(read.lines.some((line) => line.folded === true)).toBe(false);
  const text = warningText(read.warnings);
  expect(text).toContain("2");
  expect(text).toContain("3");
});

/** `code` の HTML の中の `mdmark-code-line` の開始タグを、コードブロックごとに返却する */
function codeLineTags(html: string): string[][] {
  return html
    .split("<pre")
    .slice(1)
    .map((block) =>
      findTags(block.slice(0, block.indexOf("</pre>")), 'mdmark-code-line"'),
    );
}

// インデントのある行と畳める行を行に分け、fold の行を畳んだ状態にする（正常系）
test("test_build_code_blocks_when_foldable", () => {
  // 準備
  const markdown = [
    '<!-- code: {"fold": [2]} -->',
    "",
    "```yaml",
    "a:",
    "  b:",
    "    c: 1",
    "  d: 2",
    "```",
    "",
    "```json",
    "{",
    '  "a": {',
    '    "b": 1',
    "  }",
    "}",
    "```",
    "",
    "```tree",
    "src/",
    "├── a.ts",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, { syntax: false });
  // 検証
  const [yaml = [], json = []] = codeLineTags(html);
  expect(yaml).toHaveLength(4);
  expect(yaml[0]).toContain('data-fold-lines="3"');
  expect(yaml[1]).toContain('data-indent="1"');
  expect(yaml[1]).toContain('data-fold-lines="1"');
  expect(yaml[1]).toContain("data-folded");
  expect(yaml[2]).toContain('data-indent="2"');
  expect(yaml[3]).toContain('data-indent="1"');
  expect(yaml[3]).not.toContain("data-fold-lines");
  expect(json[0]).toContain('data-fold-lines="3"');
  expect(json[1]).toContain('data-fold-lines="1"');
  const tree = html.slice(html.indexOf("mdmark-tree"));
  expect(tree).not.toContain("mdmark-code-line");
  expect(tree).not.toContain("data-fold-lines");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 畳めない fold の行を警告にする（異常系）
test("test_build_code_blocks_when_fold_invalid", () => {
  // 準備
  const markdown = [
    '<!-- code: {"fold": [1, 3, 99]} -->',
    "",
    "```yaml",
    "a:",
    "  b: 1",
    "  c: 2",
    "  d: 3",
    "  e: 4",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, { syntax: false });
  // 検証
  expect(findTags(html, 'class="mdmark-syntax-warning"')).toHaveLength(1);
  const warning = html.slice(
    html.indexOf("mdmark-syntax-warning"),
    html.indexOf("<pre"),
  );
  expect(warning).toContain("3");
  expect(warning).toContain("99");
  const [lines = []] = codeLineTags(html);
  expect(lines.map((tag) => tag.includes("data-folded"))).toEqual([
    true,
    false,
    false,
    false,
    false,
  ]);
  for (const text of ["a:", "b: 1", "c: 2", "d: 3", "e: 4"]) {
    expect(html).toContain(text);
  }
});

// focus の行を持つ pre に mdmark-code-has-focus を付ける（正常系）
test("test_build_code_blocks_when_focus", () => {
  // 準備
  const markdown = [
    "```ts",
    "a(); // [!code focus]",
    "b(); // [!code error]",
    "c(); // [!code warning]",
    "d();",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, { syntax: false });
  // 検証
  const pre = findTag(html, "<pre");
  expect(pre).toContain("mdmark-code-lines");
  expect(pre).toContain("mdmark-code-has-focus");
  const [lines = []] = codeLineTags(html);
  expect(lines[0]).toContain('data-kind="focus"');
  expect(lines[1]).toContain('data-kind="error"');
  expect(lines[2]).toContain('data-kind="warning"');
  expect(lines[3]).not.toContain("data-kind");
  expect(html).not.toContain("[!code");
  expect(innerHtml(html, "<pre")).not.toContain("//");
});

// wrap を読み込む（正常系）
test("test_read_code_spec_when_wrap", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  // 実行
  const wrapped = readCodeSpec({
    options: { lines: {}, wrap: true },
    lineCount: 3,
  });
  const plain = readCodeSpec({ options: {}, lineCount: 3 });
  // 検証
  expect(wrapped.wrap).toBe(true);
  expect(wrapped.warnings).toEqual([]);
  expect(plain.wrap).toBe(false);
  expect(plain.lineNumbers).toBe(false);
  expect(plain.warnings).toEqual([]);
});

// 最初の行の番号から数えて強調する行を読む（正常系）
test("test_read_code_spec_when_line_start", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  const options = { lines: { start: 10 }, highlight: [11, { from: 13 }] };
  // 実行
  const spec = readCodeSpec({ options, lineCount: 5 });
  // 検証
  expect(spec.lineStart).toBe(10);
  expect([...spec.highlights]).toEqual([2, 4]);
  expect(spec.warnings).toEqual([]);
});

// tree_warning の false だけで罫線の記載の警告を止める（正常系）
test("test_read_code_spec_when_tree_warning", async () => {
  // 準備
  const { readCodeSpec } = await loadCodeBlocks();
  // 実行
  const off = readCodeSpec({ options: { tree_warning: false }, lineCount: 3 });
  const on = readCodeSpec({ options: { tree_warning: true }, lineCount: 3 });
  const omitted = readCodeSpec({ options: {}, lineCount: 3 });
  // 検証
  expect(off.treeWarning).toBe(false);
  expect(on.treeWarning).toBe(true);
  expect(omitted.treeWarning).toBe(true);
  expect([...off.warnings, ...on.warnings, ...omitted.warnings]).toEqual([]);
});

// 今の罫線と ASCII の罫線と縦線の後ろの罫線を数える（正常系）
test("test_count_tree_lines", async () => {
  // 準備
  const { countTreeLines } = await loadCodeBlocks();
  const source = [
    "mdmark/",
    "├── src/",
    "│   └── index.ts",
    "└── README.md",
    "|-- a",
    "`-- b",
    "|   |-- c",
    "│   └── b",
  ].join("\n");
  // 実行
  const count = countTreeLines(source);
  // 検証
  expect(count).toBe(7);
});

// 行の途中の罫線と、罫線の後ろに空白の無い行は数えない（正常系）
test("test_count_tree_lines_when_not_tree", async () => {
  // 準備
  const { countTreeLines } = await loadCodeBlocks();
  const source = ["a ├── b", "├──b", "-- コメント", "const a = b || c;"].join(
    "\n",
  );
  // 実行
  const count = countTreeLines(source);
  // 検証
  expect(count).toBe(0);
});

/** 罫線のフォルダ構成の行（3 行が罫線） */
const TREE_LINES = ["mdmark/", "├── src/", "│   └── index.ts", "└── README.md"];

// 罫線の行が 2 行以上の言語が tree でないコードブロックの前に罫線の記載の警告を差し込む（異常系）
test("test_build_code_blocks_when_tree_lines", () => {
  // 準備
  const markdown = [
    "```text",
    ...TREE_LINES,
    "```",
    "",
    "```",
    "src/",
    "|-- index.ts",
    "`-- parts/",
    "```",
    "",
    "```text",
    "dist/",
    "└── index.js",
    "```",
    "",
    '<!-- code: {"tree_warning": false} -->',
    "",
    "```text",
    ...TREE_LINES,
    "```",
    "",
    "```tree",
    ...TREE_LINES,
    "```",
    "",
    '<!-- code: {"tree_warning": "no"} -->',
    "",
    "```text",
    ...TREE_LINES,
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const blocks = html.split(
    /(?=<div class="mdmark-syntax-warning"|<(?:div|figure) class="mdmark-code"|<div class="mdmark-tree")/,
  );
  const kinds = blocks.map((part) =>
    part.startsWith('<div class="mdmark-syntax-warning"')
      ? part.includes("罫線のフォルダ構成があります")
        ? "tree-warning"
        : "warning"
      : part.startsWith('<div class="mdmark-tree"')
        ? "tree"
        : part.startsWith("<")
          ? "code"
          : "other",
  );
  expect(kinds.filter((kind) => kind !== "other")).toEqual([
    "tree-warning",
    "code",
    "tree-warning",
    "code",
    "code",
    "code",
    "tree",
    "warning",
    "tree-warning",
    "code",
  ]);
  expect(html).toContain(
    "言語 <code>text</code> のコードブロックに、罫線のフォルダ構成があります。",
  );
  expect(html).toContain(
    "言語の無いコードブロックに、罫線のフォルダ構成があります。",
  );
  expect(html).toContain("tree_warning");
  expect(matches(html, /<code class="language-text"/g)).toHaveLength(4);
});

// mermaid のコードブロックと code がオフの文書には罫線の記載の警告を出さない（正常系）
test("test_build_code_blocks_when_tree_lines_in_mermaid", () => {
  // 準備
  const mermaid = ["```mermaid", ...TREE_LINES, "```", ""].join("\n");
  const text = ["```text", ...TREE_LINES, "```", ""].join("\n");
  // 実行
  const withMermaid = renderDoc(mermaid).html;
  const withoutCode = renderDoc(text, { code: false }).html;
  // 検証
  expect(withMermaid).not.toContain("mdmark-syntax-warning");
  expect(withoutCode).not.toContain("mdmark-syntax-warning");
});
