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
  expect(opens[0]).toContain(
    'data-map-args="{&quot;title&quot;:&quot;全体の構成&quot;,&quot;interval&quot;:3}"',
  );
  expect(opens[1]).toContain('data-map="2"');
  expect(opens[1]).toContain('data-map-kind="sequenceDiagram"');
  expect(html).not.toContain("data-mdmark-mermaid");
  expect(matches(html, /<pre class="mdmark-map-data" hidden>/g)).toHaveLength(
    1,
  );
  expect(html).not.toContain("map-data:");
  // pre の中身は補足の JSON のまま（HTML の特殊文字だけを置き換える）
  const pre =
    html.match(/<pre class="mdmark-map-data" hidden>([\s\S]*?)<\/pre>/)?.[1] ??
    "";
  const decoded = pre
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
  expect(JSON.parse(decoded)).toEqual(JSON.parse(DATA));
});

// 範囲の形の誤り（異常系）
test("test_build_map_ranges_when_problems", () => {
  // 準備
  const markdown = mapRange({
    args: "{title: 全体}",
    mermaid: "flowchart LR\n  A --> B\n  A -> B\n",
    data: '{"version": 1, "layuot": {}}',
  });
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(1);
  const warning = html.slice(
    html.indexOf("mdmark-syntax-warning"),
    html.indexOf('class="mdmark-map"'),
  );
  expect(warning).toContain("JSON");
  expect(warning).not.toContain("layuot");
  expect(warning).not.toContain("A -&gt; B");
  expect(html).toContain('class="mdmark-map"');
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

// 用語（正常系）
test("test_build_map_ranges_when_terms", () => {
  // 準備
  const markdown = mapRange({ mermaid: FLOW, data: DATA });
  const index = {
    schema: 2 as const,
    docs: [],
    terms: [
      { id: "data", term: "補足", meaning: "map の範囲の上書きと説明" },
      { id: "figure", term: "図", meaning: "" },
    ],
  };
  // 実行
  const on = renderDoc(markdown, {}, { index }).html;
  const off = renderDoc(markdown, { glossary: false }, { index }).html;
  // 検証
  const attr =
    on.match(/<div class="mdmark-map"[^>]*data-map-terms="([^"]*)"/)?.[1] ?? "";
  const terms = JSON.parse(
    attr.replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
  );
  expect(terms).toEqual({ 補足: "map の範囲の上書きと説明" });
  expect(off).not.toContain("data-map-terms");
});

// 補足が参照する注記の番号を範囲に入れる（正常系）
test("test_build_map_ranges_when_annotations", () => {
  // 準備
  const markdown = [
    "画像を埋める※[img]。",
    "",
    mapRange({
      mermaid: FLOW,
      data: '{"version": 1, "notes": {"mount": {"annotations": ["cond", "img", "missing"]}}}',
    }),
    "※[cond]: 条件の補足",
    "",
    "※[img]: 画像の補足",
    "",
  ].join("\n");
  // 実行
  const on = renderDoc(markdown);
  const off = renderDoc(markdown, { annotations: false });
  // 検証
  const attribute = /data-map-annotations="([^"]*)"/.exec(on.html)?.[1] ?? "";
  expect(JSON.parse(attribute.replaceAll("&quot;", '"'))).toEqual({
    cond: 2,
    img: 1,
  });
  expect(off.html).toContain('class="mdmark-map"');
  expect(off.html).not.toContain("data-map-annotations");
});
