import { expect, test } from "vitest";
import { findTag, outerHtml } from "../../helpers/html.ts";

/** 差分の行の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLines = () => import("../../../../src/parts/diff-lines.ts");

// 同じ行・語を書き換えた削除した行と追加した行
const NORMAL_BLOCKS = [
  {
    type: "lines" as const,
    lines: [
      {
        kind: "same" as const,
        parts: [{ text: "# ガイド", changed: false }],
      },
      {
        kind: "del" as const,
        parts: [
          { text: "差分", changed: true },
          { text: "を色分けして読む。", changed: false },
        ],
      },
      {
        kind: "add" as const,
        parts: [
          { text: "変更", changed: true },
          { text: "を色分けして読む。", changed: false },
        ],
      },
    ],
  },
];

// 行の種類と変わった語を出す（正常系）
test("test_render_diff_lines", async () => {
  // 準備
  const { renderDiffLines } = await loadLines();
  // 実行
  const html = renderDiffLines({ blocks: NORMAL_BLOCKS, sides: "side" });
  // 検証
  const group = findTag(html, "mdmark-diff-lines");
  expect(group).toContain('role="group"');
  expect(group).toContain('aria-label="変更の行"');
  const del = outerHtml(html, 'data-kind="del"');
  expect(del).toContain("-");
  expect(del).toContain("削除した行: ");
  expect(del).toContain('<del class="mdmark-diff-word">差分</del>');
  expect(findTag(del, "mdmark-diff-sign")).toContain('aria-hidden="true"');
  const add = outerHtml(html, 'data-kind="add"');
  expect(add).toContain("+");
  expect(add).toContain("追加した行: ");
  expect(add).toContain('<ins class="mdmark-diff-word">変更</ins>');
  const same = outerHtml(html, 'data-kind="same"');
  expect(same).toContain("# ガイド");
  expect(same).not.toContain("削除した行");
  expect(same).not.toContain("追加した行");
});

// 行の文字を HTML として解釈しない（正常系）
test("test_render_diff_lines_when_escaped", async () => {
  // 準備
  const { renderDiffLines } = await loadLines();
  const blocks = [
    {
      type: "lines" as const,
      lines: [
        {
          kind: "same" as const,
          parts: [{ text: "<script>alert(1)</script>", changed: false }],
        },
      ],
    },
  ];
  // 実行
  const html = renderDiffLines({ blocks, sides: "side" });
  // 検証
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});
