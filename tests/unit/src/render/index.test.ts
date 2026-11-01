import { expect, test } from "vitest";
import type { ResolvedConfig } from "../../../../src/config.ts";
import type { MdmarkAlias } from "../../../../src/knowledge/aliases.ts";
import { STRENGTH_TEXT, wrapDirective } from "../../helpers/diagrams.ts";
import { innerHtml, plainText } from "../../helpers/html.ts";

/** 描画の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRender = () => import("../../../../src/render/index.ts");

/** 既定を当てた設定を作る */
function resolvedConfig(
  libraries: ResolvedConfig["libraries"] = {},
): ResolvedConfig {
  return {
    features: { print: true },
    libraries,
    tooltips: { placement: "top" },
    syntax: { url: "https://example.test/hl/" },
    sideToc: { mode: "hover" },
    colorTheme: "dev-swiss",
    labels: { paramCopy: "今の値を写す" },
  };
}

// 設定を渡さなくても本文の HTML を返す（正常系）
test("test_render", async () => {
  // 準備
  const { render } = await loadRender();
  // 実行
  const html = render("# 見出し");
  // 検証
  expect(html).toMatch(/<h1[^>]*>見出し/);
});

// 機能の印を重ねたオン・オフを返し、印は本文に残さない（正常系）
test("test_render_document", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  // 実行
  const rendered = renderDocument({
    markdown: "<!-- features: -print -->\n\n段落\n",
    config: resolvedConfig(),
  });
  // 検証
  expect(rendered.features).toEqual({ print: false });
  expect(rendered.html).not.toContain("<!--");
});

// 同じ入力には同じ文字列を返す（解析器を使い回しても前の呼び出しの印が残らない）（正常系）
test("test_render_document_when_same_input", async () => {
  // 準備
  const { renderDocument } = await loadRender();
  const options = {
    markdown: "<!-- features: -print -->\n\n<!-- test-lib: a -->\n\n段落\n",
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

// 生の HTML で書いた記法の class・data-*・id を落とし、記法が出したものは残す（正常系）
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

// 渡したエイリアスに下線と種類のツールチップを付けた文字列を返す（正常系）
test("test_render_when_aliases", async () => {
  // 準備
  const { render } = await loadRender();
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "term",
      id: "ws",
      name: "ワークスペース",
      aliases: [],
      description: "話し合いの記録を置くフォルダ",
    },
    {
      alias_type: "command",
      id: "unit-test",
      name: "単体テスト",
      aliases: [],
      description: "ライブラリ本体の単体テストを流す",
      command: "npm run test:unit",
    },
  ];
  // 実行
  const html = render("ワークスペースと単体テストを流す。\n", { aliases });
  // 検証
  // 下線の語の隣に、種類の区分と内容を持つツールチップがある
  expect(html).toMatch(/<span class="mdmark-term"[^>]*>ワークスペース<\/span>/);
  expect(html).toMatch(/<span class="mdmark-term"[^>]*>単体テスト<\/span>/);
  const [, term, command] = html.split('class="mdmark-term-wrap"');
  expect(term).toContain(">用語<");
  expect(term).toContain("話し合いの記録を置くフォルダ");
  expect(command).toContain(">コマンド<");
  expect(command).toMatch(/<code[^>]*>npm run test:unit<\/code>/);
  expect(command).toMatch(/<button[^>]*type="button"[^>]*>[\s\S]*?コピー/);
  // スクリプトも印の文字も残らない
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
  expect(html).not.toContain("今の値を写す");
});
