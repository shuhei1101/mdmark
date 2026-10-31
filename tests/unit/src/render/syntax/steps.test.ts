import { expect, test } from "vitest";
import { type Mark, parseMarkArgs } from "../../../../../src/render/marks.ts";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** ステップの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSteps = () => import("../../../../../src/render/syntax/steps.ts");

/** `<!-- steps: {rest} -->` の開きの印（引数が無ければ `<!-- steps -->`） */
function stepsMark(rest?: string): Mark {
  return {
    name: "steps",
    args: parseMarkArgs(rest ?? ""),
    raw: rest === undefined ? "<!-- steps -->" : `<!-- steps: ${rest} -->`,
    closing: false,
    rest: rest ?? "",
  };
}

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
    "<!-- steps: closed -->",
    "",
    "1. 一つ目",
    "   1. 入れ子",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
    "<!-- steps: open title=準備 -->",
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

// 読めない指定は警告にして折り畳まずに手順にする（異常系）
test("test_build_steps_when_unreadable_options", () => {
  // 準備
  const markdown = [
    "<!-- steps: fold -->",
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
    "<!-- steps: title=準備 -->",
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(2);
  expect(html).toContain("<code>fold</code>");
  expect(html).toContain("<code>title=</code>");
  expect(matches(html, /<ol class="mdmark-steps">/g)).toHaveLength(2);
  expect(html).not.toContain("<details");
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf('<ol class="mdmark-steps">'),
  );
});

// open と title= を読む（正常系）
test("test_read_steps_options", async () => {
  // 準備
  const { readStepsOptions } = await loadSteps();
  // 実行
  const options = readStepsOptions(stepsMark("open title=準備"));
  // 検証
  expect(options.collapse).toBe("open");
  expect(options.title).toBe("準備");
  expect(options.warning).toBeUndefined();
});

// 引数が無ければ折り畳まず警告も無い（正常系）
test("test_read_steps_options_when_none", async () => {
  // 準備
  const { readStepsOptions } = await loadSteps();
  // 実行
  const options = readStepsOptions(stepsMark());
  // 検証
  expect(options.collapse).toBe("none");
  expect(options.title).toBeUndefined();
  expect(options.warning).toBeUndefined();
});

// 読めない指定を 1 つの警告にまとめる（異常系）
test("test_read_steps_options_when_unreadable", async () => {
  // 準備
  const { readStepsOptions } = await loadSteps();
  // 実行
  const options = readStepsOptions(stepsMark("closed open fold size=2"));
  // 検証
  expect(options.collapse).toBe("closed");
  expect(
    (options.warning?.items ?? []).map((item) => item.label).sort(),
  ).toEqual(["closed と open", "fold", "size="].sort());
});
