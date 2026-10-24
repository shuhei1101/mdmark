import { afterEach, expect, test } from "vitest";
import { INQUIRY_TEXT, wrapDirective } from "../../../helpers/diagrams.ts";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 拡張の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadExtensions = () => import("../../../../../src/extensions.ts");

afterEach(async () => {
  const { resetExtensions } = await loadExtensions();
  resetExtensions();
});

// 範囲を図にして、定義の JSON を残さない（正常系）
test("test_build_diagrams", () => {
  // 準備
  const markdown = wrapDirective("flow", INQUIRY_TEXT);
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /<figure[^>]*class="mdmark-diagram"/g)).toHaveLength(1);
  expect(html).not.toContain('"nodes"');
});

// 機能がオフなら、定義をコードブロックのまま描く（正常系）
test("test_build_diagrams_when_disabled", () => {
  // 準備
  const markdown = wrapDirective("flow", INQUIRY_TEXT);
  // 実行
  const { html } = renderDoc(markdown, { diagrams: false });
  // 検証
  expect(html).toContain('class="language-json"');
  expect(html).not.toContain("mdmark-diagram");
});

// 同じ名前の拡張を優先する（正常系）
test("test_build_diagrams_when_extension_registered", async () => {
  // 準備
  const { registerExtension } = await loadExtensions();
  registerExtension({
    name: "flow-extension",
    directive: "flow",
    load: async () => ({ draw: () => {} }),
  });
  const markdown = wrapDirective("flow", INQUIRY_TEXT);
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-diagram");
  expect(html).toContain('data-mdmark-slot="flow"');
});

// 読めない定義は書き方の警告にする（異常系）
test("test_build_diagrams_when_invalid", () => {
  // 準備
  const unclosed = INQUIRY_TEXT.slice(0, INQUIRY_TEXT.lastIndexOf("}"));
  const markdown = [wrapDirective("flow", unclosed), "", "後ろの段落", ""].join(
    "\n",
  );
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("フロー図の部品の定義を JSON として読めません");
  expect(html).toContain("<p>後ろの段落</p>");
  expect(html).not.toContain('mdmark-diagram"');
});
