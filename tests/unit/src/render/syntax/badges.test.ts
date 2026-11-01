import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 札にし、打ち消しはコードに戻す（正常系）
test("test_build_badges", () => {
  // 準備
  const markdown = "`badge:v0.1.0` と `badge\\:v0.1.0`\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<span class="mdmark-badge">v0.1.0</span>');
  expect(html).toContain("<code>badge:v0.1.0</code>");
});

// `badge:` の後ろが空か空白だけならコードのまま残す（正常系）
test("test_build_badges_when_empty", () => {
  // 準備
  const markdown = "`badge:` と `badge:  `\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-badge");
  expect(matches(html, /<code>badge:\s*<\/code>/g)).toHaveLength(2);
});

/** バッジの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBadges = () => import("../../../../../src/render/syntax/badges.ts");

// 色の名前の頭で色を付け、色の名前でない頭はラベルに残す（正常系）
test("test_build_badges_when_colored", () => {
  // 準備
  const markdown = "`badge:red:要確認` と `badge:v1:beta` と `badge:red:`\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<span class="mdmark-badge" data-color="red">要確認</span>',
  );
  expect(html).toContain('<span class="mdmark-badge">v1:beta</span>');
  expect(html).toContain("<code>badge:red:</code>");
});

// 色の名前の頭を色にする（正常系）
test("test_split_badge_color", async () => {
  // 準備
  const { splitBadgeColor } = await loadBadges();
  // 実行
  const results = ["red:要確認", "v1:beta", "v0.1.0"].map((text) =>
    splitBadgeColor(text),
  );
  // 検証
  expect(results).toEqual([
    { color: "red", label: "要確認" },
    { label: "v1:beta" },
    { label: "v0.1.0" },
  ]);
});

// 色の後ろが空ならラベルを空にする（正常系）
test("test_split_badge_color_when_label_empty", async () => {
  // 準備
  const { splitBadgeColor } = await loadBadges();
  // 実行
  const results = ["red:", "red:  "].map((text) => splitBadgeColor(text));
  // 検証
  for (const result of results) {
    expect(result.color).toBe("red");
    expect(result.label.trim()).toBe("");
  }
});
