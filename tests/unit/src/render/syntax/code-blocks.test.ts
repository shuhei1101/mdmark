import { expect, test } from "vitest";
import type { WarningItem } from "../../../../../src/extensions.ts";
import { parseMarkArgs } from "../../../../../src/render/marks.ts";
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

// 印と行の印を持つコードブロックも何も持たないコードブロックも帯を持つ部品にする（正常系）
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
    "```text",
    "const plain = true;",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, { syntax: false });
  // 検証: 題を持つ 1 つ目は figure と figcaption の帯で、言語のラベルが題の前にある
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
  // 検証: 題を持たない 2 つ目は div の帯で、言語のラベルが text
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

// 情報文字列の `言語:ファイル名` を言語のラベルとファイル名と読み上げの名前に分ける（正常系）
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
  // 検証: 1 つ目は言語とファイル名のラベル、`code` の class、ファイル名の読み上げの名前を持つ
  const [firstPre, secondPre] = findTags(html, "<pre");
  const [firstCode, secondCode] = findTags(html, "<code");
  expect(html).toContain(
    '<span class="mdmark-code-lang-name" aria-hidden="true">python</span>',
  );
  expect(html).toContain('<span class="mdmark-code-file">hoge.py</span>');
  expect(firstCode).toContain('class="language-python"');
  expect(firstPre).toContain('aria-label="コード: hoge.py"');
  // 検証: 2 つ目は言語のラベルを持たず、`code` が class を持たず、読み上げの名前が `コード`
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

// 打ち消した印は `\` を外した文字の行にする（正常系）
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
  expect(html.indexOf("mdmark-code-bar")).toBeGreaterThan(warning);
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
    "<!-- features: -syntax -->",
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
    "<!-- code: lines -->",
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

// `code` がオフでも `syntax` がオンなら、行の印を外さず帯を持たない部品で色分けの属性を付ける（正常系）
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

// dockerfile・diff と別名を色分けの言語に引く（正常系）
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

// dockerfile・diff と別名を引く（正常系）
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

// 表に無い語と継承した名前は引かない（正常系）
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
