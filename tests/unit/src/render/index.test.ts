import { expect, test } from "vitest";
import type { ResolvedConfig } from "../../../../src/config.ts";

/** 描画の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRender = () => import("../../../../src/render/index.ts");

/** 既定を当てた設定を作る */
function resolvedConfig(
  libraries: ResolvedConfig["libraries"] = {},
): ResolvedConfig {
  return { features: { print: true }, libraries };
}

// 設定を渡さなくても本文の HTML を返す（正常系）
test("test_render", async () => {
  // 準備
  const { render } = await loadRender();
  // 実行
  const html = render("# 見出し");
  // 検証
  expect(html).toContain("<h1>見出し</h1>");
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
