import { expect, test } from "vitest";
import { renderDoc } from "../../../helpers/render.ts";

// 5 種を種類ごとの枠にする（正常系）
test("test_build_callouts", () => {
  // 準備
  const kinds = [
    ["NOTE", "note", "補足"],
    ["TIP", "tip", "ヒント"],
    ["IMPORTANT", "important", "重要"],
    ["WARNING", "warning", "警告"],
    ["CAUTION", "caution", "注意"],
  ];
  const markdown = kinds
    .map(([kind]) => `> [!${kind}]\n> ${kind} の本文\n`)
    .join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  for (const [, lower, title] of kinds) {
    expect(html).toContain(`markdown-alert-${lower}`);
    expect(html).toContain(`<p class="markdown-alert-title">${title}</p>`);
  }
  expect(html).not.toContain("[!");
});

// 末尾の - は折り畳み、知らない種類は note にする（正常系）
test("test_build_callouts_when_collapsed_or_unknown", () => {
  // 準備
  const markdown = "> [!WARNING]-\n> 折り畳み\n\n> [!FAQ]\n> 知らない種類\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<details class="markdown-alert markdown-alert-warning">',
  );
  expect(html).toContain("markdown-alert-note");
  expect(html).not.toContain("markdown-alert-faq");
});
