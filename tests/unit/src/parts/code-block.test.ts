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
