import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 範囲の番号付きリストを手順にし、入れ子はそのままにする（正常系）
test("test_build_steps", () => {
  // 準備
  const markdown = [
    "<!-- steps -->",
    "",
    "1. 一つ目",
    "   1. 入れ子",
    "2. 二つ目",
    "3. 三つ目",
    "",
    "<!-- /steps -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /<ol\b[^>]*>/g)).toEqual([
    '<ol class="mdmark-steps">',
    "<ol>",
  ]);
});

// 番号付きリストが無い範囲は警告を差し込む（正常系）
test("test_build_steps_when_no_list", () => {
  // 準備
  const markdown = "<!-- steps -->\n\n- 一つ目\n- 二つ目\n\n<!-- /steps -->\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("<ul>");
  expect(html).not.toContain("mdmark-steps");
});
