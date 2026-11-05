import { expect, test } from "vitest";
import { findTags } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 区切りで列に分ける（正常系）
test("test_build_layout_columns", () => {
  // 準備
  const markdown = [
    "<!-- columns -->",
    "",
    "左",
    "",
    "<!-- column -->",
    "",
    "右",
    "",
    "<!-- /columns -->",
    "",
    "<!-- columns -->",
    "",
    "一",
    "",
    "<!-- column -->",
    "",
    "二",
    "",
    "<!-- column -->",
    "",
    "三",
    "",
    "<!-- /columns -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTags(html, "mdmark-layout-columns")).toHaveLength(2);
  expect(html).toContain('data-count="2"');
  expect(html).toContain('data-count="3"');
  expect(findTags(html, '"mdmark-layout-column"')).toHaveLength(5);
  expect(html).not.toContain("<!--");
});

// 2〜3 列でない範囲と入れ子は囲まずに警告する（異常系）
test("test_build_layout_columns_when_invalid", () => {
  // 準備
  const four = [
    "<!-- columns -->",
    "",
    "1",
    "",
    "<!-- column -->",
    "",
    "2",
    "",
    "<!-- column -->",
    "",
    "3",
    "",
    "<!-- column -->",
    "",
    "4",
    "",
    "<!-- /columns -->",
    "",
  ];
  const one = ["<!-- columns -->", "", "単独", "", "<!-- /columns -->", ""];
  const nested = [
    "<!-- columns -->",
    "",
    "外1",
    "",
    "<!-- columns -->",
    "",
    "内1",
    "",
    "<!-- column -->",
    "",
    "内2",
    "",
    "<!-- /columns -->",
    "",
    "<!-- column -->",
    "",
    "外2",
    "",
    "<!-- /columns -->",
    "",
  ];
  // 実行
  const { html } = renderDoc([...one, ...four, ...nested].join("\n"));
  // 検証
  expect(findTags(html, "mdmark-syntax-warning")).toHaveLength(3);
  expect(findTags(html, "mdmark-layout-columns")).toHaveLength(1);
  expect(html).toContain('data-count="2"');
  expect(html).toContain("単独");
  expect(html).toContain("内2");
});
