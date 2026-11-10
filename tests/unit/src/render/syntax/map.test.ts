import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
import { DATA, FLOW, mapRange, SEQUENCE } from "../../../helpers/map.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 2 つの範囲（正常系）
test("test_build_map_ranges", () => {
  // 準備
  const markdown = `${mapRange({ args: '{"title": "全体の構成", "interval": 3}', mermaid: FLOW, data: DATA })}\n${mapRange({ mermaid: SEQUENCE })}`;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const opens = matches(html, /<div class="mdmark-map"[^>]*>/g);
  expect(opens).toHaveLength(2);
  expect(opens[0]).toContain('data-map="1"');
  expect(opens[0]).toContain('data-map-kind="flowchart"');
  expect(opens[0]).toContain('data-map-args="{&quot;title&quot;:&quot;全体の構成&quot;,&quot;interval&quot;:3}"');
  expect(opens[1]).toContain('data-map="2"');
  expect(opens[1]).toContain('data-map-kind="sequenceDiagram"');
  expect(html).not.toContain("data-mdmark-mermaid");
  expect(matches(html, /<pre class="mdmark-map-data" hidden>/g)).toHaveLength(1);
  expect(html).not.toContain("map-data:");
});

// 書き方の誤り（異常系）
test("test_build_map_ranges_when_problems", () => {
  // 準備
  const markdown = mapRange({ mermaid: "flowchart LR\n  A --> B\n  A -> B\n", data: "version: 1\nlayuot: {}\n" });
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(1);
  expect(html).toContain("layuot");
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(html.indexOf('class="mdmark-map"'));
});

// mermaid のブロックが無い（異常系）
test("test_build_map_ranges_when_no_mermaid", () => {
  // 準備
  const markdown = mapRange({ data: DATA });
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(1);
  expect(html).not.toContain('class="mdmark-map"');
});

// 機能を外した（正常系）
test("test_build_map_ranges_when_disabled", () => {
  // 準備
  const markdown = mapRange({ mermaid: FLOW, data: DATA });
  // 実行
  const { html } = renderDoc(markdown, { map: false });
  // 検証
  expect(html).not.toContain('class="mdmark-map"');
  expect(html).toContain("data-mdmark-mermaid");
  expect(html).not.toContain("layout:");
});
