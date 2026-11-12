import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
import { jsonMark } from "../../../helpers/marks.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** ステップの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSteps = () => import("../../../../../src/render/syntax/steps.ts");

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

// closed・open のステップを title= か項目の数の見出しの折り畳みに入れる（正常系）
test("test_build_steps_when_collapsed", () => {
  // 準備
  const markdown = [
    '<!-- steps: {"collapse": {"open": false}} -->',
    "",
    "1. 一つ目",
    "   1. 入れ子",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
    '<!-- steps: {"collapse": {"open": true, "title": "準備"}} -->',
    "",
    "1. 一つ目",
    "2. 二つ目",
    "3. 三つ目",
    "",
    "<!-- /steps -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<details class="mdmark-collapsible"><summary>手順（2 ステップ）</summary><ol class="mdmark-steps">',
  );
  expect(html).toContain(
    '<details class="mdmark-collapsible" open><summary>準備</summary>',
  );
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 読み込めない指定は警告にして折り畳まずに手順にする（異常系）
test("test_build_steps_when_unreadable_options", () => {
  // 準備
  const markdown = [
    '<!-- steps: {"fold": true} -->',
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
    '<!-- steps: {"collapse": "closed"} -->',
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
  ].join("\n");
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(1);
  expect(html).toContain("collapse");
  expect(
    warnings.filter((warning) => warning.kind === "unknown_mark_arg"),
  ).toHaveLength(1);
  expect(matches(html, /<ol class="mdmark-steps">/g)).toHaveLength(2);
  expect(html).not.toContain("<details");
  expect(html.indexOf("mdmark-syntax-warning")).toBeGreaterThan(
    html.indexOf('<ol class="mdmark-steps">'),
  );
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.lastIndexOf('<ol class="mdmark-steps">'),
  );
});

// 開いた折り畳みと見出しを読み込む（正常系）
test("test_read_steps_options", async () => {
  // 準備
  const { readStepsOptions } = await loadSteps();
  // 実行
  const options = readStepsOptions(
    jsonMark("steps", { collapse: { open: true, title: "準備" } }),
  );
  // 検証
  expect(options).toEqual({ collapse: "open", title: "準備" });
});

// 引数が無ければ折り畳まない（正常系）
test("test_read_steps_options_when_none", async () => {
  // 準備
  const { readStepsOptions } = await loadSteps();
  // 実行
  const options = readStepsOptions(jsonMark("steps"));
  // 検証
  expect(options.collapse).toBe("none");
  expect(options.title).toBeUndefined();
});
