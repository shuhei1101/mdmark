import { expect, test } from "vitest";
import { findTag, findTags, innerHtml } from "../../helpers/html.ts";

/** コードブロックの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCodeBlock = () => import("../../../../src/parts/code-block.ts");

// 題・行番号・行の種類を付け、文字をエスケープする（正常系）
test("test_render_code_block", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "a<b>.ts",
    lineNumbers: true,
    lines: [{ text: "x < 1", kind: "add" }, { text: "y" }],
  });
  // 検証: 題を持てば figure と figcaption の帯で、言語のラベルが題の前にある
  expect(
    html.startsWith(
      '<figure class="mdmark-code"><figcaption class="mdmark-code-title mdmark-code-bar">',
    ),
  ).toBe(true);
  const caption = innerHtml(html, "mdmark-code-title");
  expect(caption).toContain(
    '<span class="mdmark-code-lang-name" aria-hidden="true">ts</span>',
  );
  expect(caption.indexOf("mdmark-code-lang")).toBeLessThan(
    caption.indexOf("a&lt;b&gt;.ts"),
  );
  expect(html).not.toContain("mdmark-code-copy");
  const pre = findTag(html, "<pre");
  expect(pre).toContain("mdmark-code-lines");
  expect(pre).toContain("mdmark-code-numbered");
  expect(pre).toContain("mdmark-code-signs");
  expect(pre).toContain('aria-label="コード: a&lt;b&gt;.ts"');
  const lines = findTags(html, 'class="mdmark-code-line"');
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain('data-line="1"');
  expect(lines[0]).toContain('data-kind="add"');
  expect(lines[1]).toContain('data-line="2"');
  expect(lines[1]).not.toContain("data-kind");
  expect(html).toContain('<span class="mdmark-code-text">x &lt; 1</span>');
});

// 題だけなら行に分けない（正常系）
test("test_render_code_block_when_title_only", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "yaml",
    title: "a.yaml",
    lineNumbers: false,
    lines: [{ text: "features:" }, { text: "  code: true" }],
  });
  // 検証
  expect(html.startsWith('<figure class="mdmark-code"')).toBe(true);
  expect(findTag(html, "<pre")).not.toContain("class=");
  expect(html).not.toContain("mdmark-code-line");
});

// 行の数の桁の数を渡す（正常系）
test("test_render_code_block_when_two_digits", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  const lines = Array.from({ length: 13 }, (_, index) => ({
    text: `line ${index + 1}`,
  }));
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "",
    lineNumbers: true,
    lines,
  });
  // 検証
  expect(findTag(html, "<code")).toContain('style="--mdmark-code-digits: 2"');
  const last = findTags(html, 'class="mdmark-code-line"').at(-1);
  expect(last).toContain('data-line="13"');
});

// 色分けする言語を渡すと code に色分けの対象の属性を付ける（正常系）
test("test_render_code_block_when_syntax", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  const lines = [{ text: "a: 1" }];
  // 実行
  const withSyntax = renderCodeBlock({
    language: "yml",
    title: "",
    lineNumbers: false,
    lines,
    syntax: "yaml",
  });
  const withoutSyntax = renderCodeBlock({
    language: "yml",
    title: "",
    lineNumbers: false,
    lines,
  });
  // 検証
  expect(
    withSyntax.startsWith(
      '<div class="mdmark-code"><div class="mdmark-code-bar">',
    ),
  ).toBe(true);
  expect(withSyntax).toContain(
    '<pre tabindex="0" aria-label="コード: yml"><code class="language-yml" data-mdmark-syntax="yaml">',
  );
  expect(findTag(withoutSyntax, "<code")).not.toContain("data-mdmark-syntax");
});

// mermaid の対象は一番外の要素に属性を付ける（正常系）
test("test_render_code_block_when_mermaid", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  const options = {
    language: "mermaid",
    title: "",
    lineNumbers: false,
    lines: [{ text: "flowchart LR" }],
    mermaid: true,
  };
  // 実行
  const withBar = renderCodeBlock(options);
  const withoutBar = renderCodeBlock({ ...options, bar: false });
  // 検証
  expect(withBar.startsWith('<div class="mdmark-code" data-mdmark-mermaid>')).toBe(true);
  expect(withoutBar.startsWith("<pre data-mdmark-mermaid")).toBe(true);
  expect(withBar).not.toContain("data-mdmark-syntax");
  expect(withoutBar).not.toContain("data-mdmark-syntax");
});

// ファイル名を言語の後ろに出し、読み上げの名前に使う（正常系）
test("test_render_code_block_when_file_name", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "python",
    fileName: "hoge.py",
    title: "",
    lineNumbers: false,
    lines: [{ text: "print(1)" }],
  });
  // 検証
  const label = innerHtml(html, "mdmark-code-lang");
  expect(
    label.startsWith(
      '<span class="mdmark-code-lang-name" aria-hidden="true">python</span>',
    ),
  ).toBe(true);
  expect(label).toContain('<span class="mdmark-code-file">hoge.py</span>');
  expect(findTag(html, "<pre")).toContain('aria-label="コード: hoge.py"');
});

// 言語が無ければ帯に言語のラベルを出さない（正常系）
test("test_render_code_block_when_no_language", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "",
    title: "",
    lineNumbers: false,
    lines: [{ text: "npm install mdmark" }],
  });
  // 検証
  expect(html).toContain("mdmark-code-bar");
  expect(html).not.toContain("mdmark-code-lang");
  expect(findTag(html, "<pre")).toContain('aria-label="コード"');
});

// 帯を付けないときは pre だけを返す（正常系）
test("test_render_code_block_when_bar_off", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "",
    lineNumbers: false,
    lines: [{ text: "a" }],
    syntax: "typescript",
    bar: false,
  });
  // 検証
  expect(html.startsWith('<pre tabindex="0" aria-label="コード: ts">')).toBe(
    true,
  );
  expect(html).not.toContain("mdmark-code-bar");
});

// コピーの状態を渡すと帯の右端にボタンを置く（正常系）
test("test_render_code_block_when_copy_state", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "",
    lineNumbers: false,
    lines: [{ text: "a" }],
    copyState: "copied",
  });
  // 検証
  const bar = innerHtml(html, "mdmark-code-bar");
  expect(bar.lastIndexOf("mdmark-code-meta")).toBeGreaterThan(
    bar.indexOf("mdmark-code-lang"),
  );
  expect(findTag(bar, "mdmark-code-copy")).toContain('data-state="copied"');
  expect(bar).toContain("コピーしました");
});

// 状態ごとの文言と読み上げを返す（正常系）
test("test_render_code_copy", async () => {
  // 準備
  const { renderCodeCopy } = await loadCodeBlock();
  // 実行
  const idle = renderCodeCopy({ state: "idle" });
  const copied = renderCodeCopy({ state: "copied" });
  const failed = renderCodeCopy({ state: "failed" });
  // 検証: 文言
  expect(idle.startsWith('<span class="mdmark-code-meta">')).toBe(true);
  expect(innerHtml(idle, "mdmark-code-copy")).toContain("コピー");
  expect(innerHtml(copied, "mdmark-code-copy")).toContain("コピーしました");
  expect(innerHtml(failed, "mdmark-code-copy")).toContain(
    "コピーできませんでした",
  );
  // 検証: 読み上げの要素
  expect(innerHtml(idle, "mdmark-code-status")).toBe("");
  expect(innerHtml(copied, "mdmark-code-status")).toBe(
    "コードをコピーしました",
  );
  expect(innerHtml(failed, "mdmark-code-status")).toBe(
    "コードをコピーできませんでした",
  );
  // 検証: どれもボタンの種類と状態を持つ
  for (const [html, state] of [
    [idle, "idle"],
    [copied, "copied"],
    [failed, "failed"],
  ] as const) {
    const button = findTag(html, "mdmark-code-copy");
    expect(button).toContain('type="button"');
    expect(button).toContain(`data-state="${state}"`);
    expect(findTag(html, "mdmark-code-status")).toContain('role="status"');
  }
});

/** 部品設計『コードブロック』の `Foldable` の行（`foldedLine` の行番号の行だけ `folded`） */
function foldableLines(foldedLine?: number) {
  const lines = [
    {
      text: "export function mount(element, markdown, options = {}) {",
      foldLines: 10,
    },
    { text: "  const config = withDefaults(options);", indent: 1 },
    {
      text: "  for (const block of parse(markdown)) {",
      indent: 1,
      foldLines: 4,
    },
    { text: '    if (block.kind === "table") {', indent: 2, foldLines: 1 },
    { text: "      attachTable(block, config.features);", indent: 3 },
    { text: "    }", indent: 2 },
    { text: "    element.append(render(block));", indent: 2 },
    { text: "  }", indent: 1 },
    { text: "  return () => {", indent: 1, foldLines: 1 },
    { text: "    element.replaceChildren();", indent: 2 },
    { text: "  };", indent: 1 },
    { text: "}" },
  ];
  return lines.map((line, index) =>
    index + 1 === foldedLine ? { ...line, folded: true } : line,
  );
}

/** HTML の `mdmark-code-line` を、行ごとの開始タグから次の行の手前までの文字列にして返す */
function codeLinesOf(html: string): string[] {
  const parts = html.split('<span class="mdmark-code-line"').slice(1);
  return parts.map((part) => `<span class="mdmark-code-line"${part}`);
}

// focus・error・warning の行に種類を付ける（正常系）
test("test_render_code_block_when_line_kinds", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "",
    lineNumbers: false,
    lines: [
      { text: "a();", kind: "focus" },
      { text: "b();", kind: "error" },
      { text: "c();", kind: "warning" },
      { text: "d();" },
    ],
  });
  // 検証
  const pre = findTag(html, "<pre");
  expect(pre).toContain("mdmark-code-lines");
  expect(pre).toContain("mdmark-code-has-focus");
  const lines = findTags(html, 'class="mdmark-code-line"');
  expect(lines.map((tag) => /data-kind="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "focus",
    "error",
    "warning",
    undefined,
  ]);
});

// インデントと畳む行の属性を行に付ける（正常系）
test("test_render_code_block_when_indented", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "",
    lineNumbers: true,
    lines: foldableLines(),
  });
  // 検証
  const lines = findTags(html, 'class="mdmark-code-line"');
  expect(lines).toHaveLength(12);
  expect(lines[1]).toContain('data-indent="1"');
  expect(lines[0]).toContain('data-fold-lines="10"');
  expect(lines[2]).toContain('data-fold-lines="4"');
  expect(html).not.toContain("mdmark-code-fold");
});

// 畳んだ行の後ろを隠し、開閉のボタンと ⋯ を置く（正常系）
test("test_render_code_block_when_fold_buttons", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "",
    lineNumbers: true,
    lines: foldableLines(3),
    foldButtons: true,
  });
  // 検証
  expect(findTag(html, "<pre")).toContain("mdmark-code-foldable");
  const lines = codeLinesOf(html);
  expect(lines).toHaveLength(12);
  const third = lines[2] ?? "";
  expect(findTag(third, 'class="mdmark-code-fold"')).toContain(
    'aria-expanded="false"',
  );
  expect(third).toContain("mdmark-code-fold-more");
  for (const line of lines.slice(3, 7)) {
    expect(findTag(line, 'class="mdmark-code-line"')).toMatch(/\shidden\b/);
  }
  expect(findTag(lines[7] ?? "", 'class="mdmark-code-line"')).not.toMatch(
    /\shidden\b/,
  );
  const toggles = findTags(html, 'class="mdmark-code-fold"');
  const others = toggles.filter(
    (tag) => !tag.includes('aria-expanded="false"'),
  );
  expect(toggles.length).toBeGreaterThan(1);
  expect(others).toHaveLength(toggles.length - 1);
  for (const tag of others) {
    expect(tag).toContain('aria-expanded="true"');
  }
});

// 開閉の状態と範囲を読み上げの名前に持つ（正常系）
test("test_render_code_fold_toggle", async () => {
  // 準備
  const { renderCodeFoldToggle } = await loadCodeBlock();
  // 実行
  const html = renderCodeFoldToggle({
    expanded: false,
    from: 4,
    to: 7,
    controls: "c-4 c-5 c-6 c-7",
  });
  // 検証
  const button = findTag(html, "<button");
  expect(button).toContain('class="mdmark-code-fold"');
  expect(button).toContain('type="button"');
  expect(button).toContain('aria-expanded="false"');
  expect(button).toContain('aria-label="4 行目から 7 行目"');
  expect(button).toContain('aria-controls="c-4 c-5 c-6 c-7"');
  expect(html).toContain("<svg");
  expect(html).toContain("chevron-right");
});

// 開く範囲を読み上げの名前に持つ（正常系）
test("test_render_code_fold_more", async () => {
  // 準備
  const { renderCodeFoldMore } = await loadCodeBlock();
  // 実行
  const html = renderCodeFoldMore({ from: 4, to: 7 });
  // 検証
  const button = findTag(html, "<button");
  expect(button).toContain('class="mdmark-code-fold-more"');
  expect(button).toContain('type="button"');
  expect(button).toContain('aria-label="4 行目から 7 行目を展開"');
  expect(html).toContain("⋯");
});

// wrap のコードブロックを行に分け、折り返す class を付ける（正常系）
test("test_render_code_block_when_wrap", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  const lines = [
    { text: 'import { mount } from "mdmark";' },
    {
      text: 'const url = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.10.0/dist/index.js"; // バージョンを固定した URL から配布物を読み、描く先の要素に文書を描く',
    },
    { text: 'mount(document.querySelector("#doc"), markdown);' },
  ];
  // 実行
  const numbered = renderCodeBlock({
    language: "ts",
    title: "app.ts",
    lineNumbers: true,
    wrap: true,
    lines,
  });
  const plain = renderCodeBlock({
    language: "ts",
    title: "app.ts",
    lineNumbers: false,
    wrap: true,
    lines,
  });
  // 検証
  const classOf = (html: string) =>
    /<pre class="([^"]*)"/.exec(html)?.[1]?.split(" ") ?? [];
  expect(classOf(numbered)).toEqual(
    expect.arrayContaining([
      "mdmark-code-lines",
      "mdmark-code-numbered",
      "mdmark-code-wrap",
    ]),
  );
  expect(classOf(plain)).toEqual(
    expect.arrayContaining(["mdmark-code-lines", "mdmark-code-wrap"]),
  );
  expect(classOf(plain)).not.toContain("mdmark-code-numbered");
  for (const html of [numbered, plain]) {
    expect(findTags(html, 'class="mdmark-code-line"')).toHaveLength(3);
  }
});
