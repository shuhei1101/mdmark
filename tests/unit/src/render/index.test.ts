import { expect, test } from "vitest";
import type { ResolvedConfig } from "../../../../src/config.ts";
import type { MdmarkAlias } from "../../../../src/knowledge/aliases.ts";
import {
  INQUIRY_TEXT,
  STRENGTH_TEXT,
  WARNINGS_MARKDOWN,
  wrapDirective,
} from "../../helpers/diagrams.ts";
import { innerHtml, plainText } from "../../helpers/html.ts";

/** 描画の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRender = () => import("../../../../src/render/index.ts");

/** 既定を適用した設定を作る */
function resolvedConfig(
  libraries: ResolvedConfig["libraries"] = {},
): ResolvedConfig {
  return {
    features: { print: true },
    libraries,
    tooltips: { placement: "top", diagramPlacement: "bottom" },
    syntax: { url: "https://example.test/hl/" },
    htmlScripts: { url: "https://example.test/babel.mjs" },
    mermaid: {
      url: "https://example.test/mermaid.mjs",
      theme: "mdmark",
      themeVariables: {},
    },
    sideToc: { mode: "hover" },
    colorTheme: "dev-swiss",
    colorScheme: "auto",
    labels: { paramCopy: "今の値をコピーする" },
    table: { pin: "each", longColumnMin: 45 },
    map: { node_fit: "height", url_state: true, kinds: {}, lines: {} },
  };
}

// 設定を指定しなくても本文の HTML を返却する（正常系）
test("test_render", async () => {
  // 準備
  const { render } = await loadRender();
  // 実行
  const html = render("# 見出し");
  // 検証
  expect(html).toMatch(/<h1[^>]*>見出し/);
});

// 機能のマーカーを重ねたオン・オフを返却し、マーカーは本文に残さない（正常系）
test("test_render_document", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  // 実行
  const rendered = renderDocument({
    markdown: '<!-- features: {"print": false} -->\n\n段落\n',
    config: resolvedConfig(),
  });
  // 検証
  expect(rendered.features).toEqual({ print: false });
  expect(rendered.html).not.toContain("<!--");
});

// 同じ入力には同じ文字列を返却する（解析器を使い回しても前の呼び出しのマーカーが残らない）（正常系）
test("test_render_document_when_same_input", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  const options = {
    markdown:
      '<!-- features: {"print": false} -->\n\n<!-- test-lib: {"items": ["a"]} -->\n\n段落\n',
    config: resolvedConfig({
      "test-lib": { url: "/fixtures/test-lib.js", figure: true },
    }),
  };
  // 実行
  const first = renderDocument(options);
  const second = renderDocument(options);
  // 検証
  expect(second.html).toBe(first.html);
  expect(second.features).toEqual(first.features);
});

// 生の HTML で記載した記法の class・data-*・id を落とし、記法が出したものは残す（正常系）
test("test_render_document_when_raw_html_imitates_syntax", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  const { resolveConfig } = await import("../../../../src/config.ts");
  const markdown = [
    '<div class="mdmark-tabs" data-kind="data"><p id="fig-x">偽り</p></div>',
    "",
    "> [!NOTE]",
    "> 本物",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDocument({ markdown, config: resolveConfig({}) });
  // 検証
  expect(html).toContain("<p>偽り</p>");
  expect(html).not.toContain("mdmark-tabs");
  expect(html).not.toContain("data-kind");
  expect(html).not.toContain('id="fig-x"');
  expect(html).toContain("markdown-alert-note");
  expect(html).not.toContain("data-mdmark-own");
});

// 指定したエイリアスに下線と種類のツールチップを付けた文字列を返却する（正常系）
test("test_render_when_aliases", async () => {
  // 準備
  const { render } = await loadRender();
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "term",
      id: "ws",
      name: "ワークスペース",
      aliases: [],
      description: "話し合いの記録を配置するフォルダ",
    },
    {
      alias_type: "command",
      id: "unit-test",
      name: "単体テスト",
      aliases: [],
      description: "ライブラリ本体の単体テストを実行する",
      command: "npm run test:unit",
    },
  ];
  // 実行
  const html = render("ワークスペースと単体テストを実行する。\n", { aliases });
  // 検証
  // 下線の単語の隣に、種類の区分と内容を持つツールチップがある
  expect(html).toMatch(/<span class="mdmark-term"[^>]*>ワークスペース<\/span>/);
  expect(html).toMatch(/<span class="mdmark-term"[^>]*>単体テスト<\/span>/);
  const [, term, command] = html.split('class="mdmark-term-wrap"');
  expect(term).toContain(">用語<");
  expect(term).toContain("話し合いの記録を配置するフォルダ");
  expect(command).toContain(">コマンド<");
  expect(command).toMatch(/<code[^>]*>npm run test:unit<\/code>/);
  expect(command).toMatch(/<button[^>]*type="button"[^>]*>[\s\S]*?コピー/);
  // スクリプトもマーカーの文字も残らない
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});

// 設定の部品の文言で操作できる部品のボタンを描く（正常系）
test("test_render_document_when_labels_given", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  const { resolveConfig } = await import("../../../../src/config.ts");
  const markdown = wrapDirective("param", STRENGTH_TEXT);
  const config = { ...resolveConfig({}), labels: { paramCopy: "コピー" } };
  // 実行
  const { html } = renderDocument({ markdown, config });
  // 検証
  expect(plainText(innerHtml(html, "mdmark-param-copy"))).toBe("コピー");
  expect(html).not.toContain("今の値をコピーする");
});

// 記載の警告を場所と種類つきで返却する（正常系）
test("test_collect_warnings", async () => {
  // 準備
  const { collectWarnings, render } = await loadRender();
  const lines = WARNINGS_MARKDOWN.split("\n");
  expect(lines[0]).toBe("<!-- flow -->");
  expect(lines[19]).toBe("<!-- tabz -->");
  expect(lines[21]).toBe('<!-- code: {"highlight": [9]} -->');
  // 実行
  const warnings = collectWarnings(WARNINGS_MARKDOWN);
  // 検証
  expect(warnings.map(({ line, kind }) => ({ line, kind }))).toEqual([
    { line: 1, kind: "diagram_invalid" },
    { line: 22, kind: "syntax_warning" },
  ]);
  // 本文と項目をつなぐ空白は画面の文字に無いため、空白を除いて比べる
  const text = plainText(render(WARNINGS_MARKDOWN)).replace(/\s+/g, "");
  for (const warning of warnings) {
    expect(text).toContain(warning.message.replace(/\s+/g, ""));
  }
});

// 警告の無い Markdown は空の配列を返却する（正常系）
test("test_collect_warnings_when_clean", async () => {
  // 準備
  const { collectWarnings } = await loadRender();
  const markdown = [
    wrapDirective("flow", INQUIRY_TEXT),
    '<!-- table: {"kind": "data"} -->',
    "",
    "| 列 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
  ].join("\n");
  // 実行
  const warnings = collectWarnings(markdown);
  // 検証
  expect(warnings).toEqual([]);
});

// 先頭のフロントマターを本文に出さず、後ろのブロックの元の行番号を保つ（正常系）
test("test_render_document_when_frontmatter", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  const { resolveConfig } = await import("../../../../src/config.ts");
  const markdown = "---\ntitle: a\n---\n\n# 見出し";
  // 実行
  const { html } = renderDocument({ markdown, config: resolveConfig({}) });
  // 検証
  expect(html).not.toContain("title: a");
  expect(html).not.toContain("<hr");
  expect(html).not.toContain("<h2");
  expect(html).not.toContain("mdmark-frontmatter");
  expect(html).toMatch(/<h1[^>]* data-source-line="4"/);
});

// 機能がオンなら、本文の先頭に閉じた折りたたみの yaml のコードブロックを配置する（正常系）
test("test_render_document_when_frontmatter_enabled", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  const { resolveConfig } = await import("../../../../src/config.ts");
  const config = resolveConfig({ config: { features: { frontmatter: true } } });
  const markdown = "---\ntitle: a\n---\n\n# 見出し";
  const fenced = "---\nnote: |\n  ```\n  code\n  ```\n---\n\n本文";
  // 実行
  const { html } = renderDocument({ markdown, config });
  const { html: fencedHtml } = renderDocument({ markdown: fenced, config });
  // 検証
  expect(
    html.startsWith('<details class="mdmark-collapsible mdmark-frontmatter"'),
  ).toBe(true);
  const details = html.slice(0, html.indexOf("</details>"));
  expect(details).not.toContain(" open");
  expect(details).toContain("<summary>フロントマター</summary>");
  expect(details).toContain("language-yaml");
  expect(details).toContain("title: a");
  const fencedDetails = fencedHtml.slice(0, fencedHtml.indexOf("</details>"));
  expect(fencedDetails).toContain("code");
  expect(fencedHtml.slice(fencedHtml.indexOf("</details>"))).not.toContain(
    "code",
  );
});
