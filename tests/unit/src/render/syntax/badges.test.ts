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
