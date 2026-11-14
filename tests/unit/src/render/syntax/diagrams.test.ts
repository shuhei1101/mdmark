import { afterEach, expect, test } from "vitest";
import {
  REPLY_TIME_TEXT,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../../helpers/diagrams.ts";
import { createEnv } from "../../../helpers/env.ts";
import { erText, shopEr } from "../../../helpers/er.ts";
import { innerHtml, matches, plainText } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";
import {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
} from "../../../helpers/retired-diagrams.ts";

/** モックの `shop-er` の定義の JSON */
const SHOP_ER_TEXT = erText(shopEr());

/** 拡張の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadExtensions = () => import("../../../../../src/extensions.ts");

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../../src/render/parser.ts");

afterEach(async () => {
  const { resetExtensions } = await loadExtensions();
  resetExtensions();
});

// 範囲を図にして、定義の JSON を残さない（正常系）
test("test_build_diagrams", () => {
  // 準備
  const markdown = wrapDirective("er", SHOP_ER_TEXT);
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /<figure[^>]*class="mdmark-diagram"/g)).toHaveLength(1);
  expect(html).not.toContain('"tables"');
});

// 機能がオフなら、定義をコードブロックのまま描く（正常系）
test("test_build_diagrams_when_disabled", () => {
  // 準備
  const markdown = wrapDirective("er", SHOP_ER_TEXT);
  // 実行
  const { html } = renderDoc(markdown, { diagrams: false });
  // 検証
  expect(html).toContain('class="language-json"');
  expect(html).not.toContain("mdmark-diagram");
});

// 同じ名前の拡張を優先する（正常系）
test("test_build_diagrams_when_extension_registered", async () => {
  // 準備
  const { registerExtension, resetExtensions } = await loadExtensions();
  const cases = [
    { directive: "er", json: SHOP_ER_TEXT },
    { directive: "flow", json: INQUIRY_TEXT },
  ];
  for (const { directive, json } of cases) {
    resetExtensions();
    registerExtension({
      name: `${directive}-extension`,
      directive,
      load: async () => ({ draw: () => {} }),
    });
    // 実行
    const { html } = renderDoc(wrapDirective(directive, json));
    // 検証
    expect(html).not.toContain("mdmark-diagram");
    expect(html).not.toContain("mdmark-syntax-warning");
    expect(html).toContain(`data-mdmark-slot="${directive}"`);
  }
});

// 読み込めない定義は記載の警告にする（異常系）
test("test_build_diagrams_when_invalid", () => {
  // 準備
  const unclosed = REPLY_TIME_TEXT.slice(0, REPLY_TIME_TEXT.lastIndexOf("}"));
  const markdown = [
    wrapDirective("chart", unclosed),
    "",
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("グラフの部品の定義を JSON として読み込めません");
  expect(html).toContain("<p>後ろの段落</p>");
  expect(html).not.toContain('mdmark-diagram"');
});

// 廃止した図の範囲を記載の警告にし、範囲の中身を残さない（正常系）
test("test_build_diagrams_when_retired", () => {
  // 準備
  const markdown = [
    wrapDirective("flow", INQUIRY_TEXT),
    wrapDirective("sequence", INQUIRY_SEQ_TEXT),
  ].join("\n");
  // 実行
  const results = [
    renderDoc(markdown).html,
    renderDoc(markdown, { diagrams: false }).html,
  ];
  // 検証
  for (const html of results) {
    const warnings = matches(
      html,
      /<div class="mdmark-syntax-warning"[\s\S]*?<\/div>/g,
    ).map(plainText);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain(
      "<!-- flow --> の図の記載方法は廃止しました。",
    );
    expect(warnings[1]).toContain(
      "<!-- sequence --> の図の記載方法は廃止しました。",
    );
    for (const warning of warnings) {
      expect(warning).toContain("mdmark upgrade");
    }
    expect(html).not.toContain('"nodes"');
    expect(html).not.toContain("mdmark-diagram");
  }
});

// 操作できる部品のボタンを `env.labels.paramCopy` の文言で描く（正常系）
test("test_build_diagrams_when_param_copy_label", async () => {
  // 準備
  const { createParser } = await loadParser();
  const markdown = wrapDirective("param", STRENGTH_TEXT);
  const env = createEnv({ labels: { paramCopy: "コピー" } });
  // 実行
  const html = createParser().render(markdown, env);
  // 検証
  expect(plainText(innerHtml(html, "mdmark-param-copy"))).toBe("コピー");
});

/** 図の部品の範囲を探す処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiagrams = () =>
  import("../../../../../src/render/syntax/diagrams.ts");

// 図の部品の範囲だけを返却する（正常系）
test("test_find_diagram_blocks", async () => {
  // 準備
  const { findDiagramBlocks } = await loadDiagrams();
  const markdown = [
    "# 図",
    "",
    wrapDirective("flow", INQUIRY_TEXT),
    wrapDirective("chart", '{ "type": "bar" }'),
    "<!-- html -->",
    "",
    "```html",
    "<mdmark-chart>",
    '{ "type": "pie" }',
    "</mdmark-chart>",
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
  // 実行
  const found = findDiagramBlocks(markdown);
  // 検証
  expect(found).toHaveLength(2);
  expect(found[0]).toEqual({
    directive: "flow",
    line: 3,
    end: 3 + INQUIRY_TEXT.split("\n").length + 5,
    blocks: [INQUIRY_TEXT],
  });
  expect(found[1]?.directive).toBe("chart");
  expect(found[1]?.blocks).toEqual(['{ "type": "bar" }']);
});
