import { expect, test } from "vitest";
import { FLOW } from "../../helpers/map.ts";

/** flowchart の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFlowchart = () => import("../../../../src/map/flowchart.ts");

// 入れ子の subgraph・クラス・ラベル付きの線（正常系）
test("test_parse_flowchart", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(FLOW);
  // 検証
  expect(chart.direction).toBe("LR");
  expect(chart.nodes).toHaveLength(10);
  expect(chart.groups).toHaveLength(4);
  expect(chart.edges).toHaveLength(12);
  expect(chart.problems).toEqual([]);
  const marker = chart.nodes.find((node) => node.id === "marker");
  expect(marker).toMatchObject({
    label: "map のマーカーの読み取り",
    classes: ["step"],
    parent: "read",
  });
  expect(chart.groups.find((group) => group.id === "read")).toMatchObject({
    title: "記法の読み取り",
    parent: "lib",
    direction: "TB",
  });
  expect(chart.nodes.find((node) => node.id === "user")).toMatchObject({
    shape: "stadium",
    classes: ["outside"],
    parent: undefined,
  });
});

// 形状の記法（正常系）
test("test_parse_flowchart_when_shapes", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  const source =
    "flowchart TB\n  A([a])\n  B[(b)]\n  C{c}\n  D((d))\n  E{{e}}\n  F[[f]]\n";
  // 実行
  const chart = parseFlowchart(source);
  // 検証
  expect(chart.nodes.map((node) => node.shape)).toEqual([
    "stadium",
    "cylinder",
    "rhombus",
    "circle",
    "hexagon",
    "subroutine",
  ]);
});

// 連なりと & の線（正常系）
test("test_parse_flowchart_when_chained", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart("flowchart LR\n  A & B --> C --> D\n");
  // 検証
  expect(chart.edges.map((edge) => [edge.from, edge.to])).toEqual([
    ["A", "C"],
    ["B", "C"],
    ["C", "D"],
  ]);
});

// 線の ID と重なり（正常系）
test("test_parse_flowchart_when_edge_ids", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    "flowchart LR\n  A e1@--> C\n  A --> B\n  A --> B\n",
  );
  // 検証
  expect(chart.edges.map((edge) => edge.id)).toEqual(["e1", "A->B", "A->B#2"]);
});

// 読めない行（異常系）
test("test_parse_flowchart_when_unreadable_line", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    "flowchart LR\n  A --> B\n  B --> C\n  A -> B\n  C --> D\n",
  );
  // 検証
  expect(chart.problems).toHaveLength(1);
  expect(chart.problems[0]).toMatchObject({ kind: "map_invalid", line: 3 });
  expect(chart.problems[0]?.message).toContain("-->");
  expect(chart.edges.map((edge) => edge.id)).toEqual(["A->B", "B->C", "C->D"]);
});

// 閉じの無い subgraph（異常系）
test("test_parse_flowchart_when_unclosed_subgraph", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    "flowchart LR\n  subgraph g [グループ]\n    A --> B\n",
  );
  // 検証
  expect(chart.problems).toHaveLength(1);
  expect(chart.problems[0]?.kind).toBe("map_invalid");
  expect(chart.problems[0]?.message).toContain("g");
  expect(chart.groups.map((group) => group.id)).toEqual(["g"]);
});

// click の行のリンク先を読み、関数を指す形を捨てる（正常系）
test("test_parse_flowchart_when_click", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    [
      "flowchart LR",
      "  a --> b --> c",
      '  click a "https://example.com/spec" "説明" _blank',
      '  click b href "./other.md"',
      "  click c callback",
    ].join("\n"),
  );
  // 検証
  expect(chart.links).toEqual({
    a: "https://example.com/spec",
    b: "./other.md",
  });
  expect(chart.problems).toEqual([]);
});

// ラベルとタイトルの文字の参照を文字に戻す（正常系）
test("test_parse_flowchart_when_entity", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    [
      "flowchart TB",
      '  subgraph g["#91;枠#93;"]',
      "    a[#quot;a#quot; #91;b#93;<br>#35;c]",
      "  end",
      "  a -->|x #124; y| b",
    ].join("\n"),
  );
  // 検証
  expect(chart.problems).toEqual([]);
  expect(chart.groups[0]?.title).toBe("[枠]");
  expect(chart.nodes.find((node) => node.id === "a")?.label).toBe(
    '"a" [b]\n#c',
  );
  expect(chart.edges[0]?.label).toBe("x | y");
});

// 名前と番号の参照を戻し、参照でない文字を残す（正常系）
test("test_decode_entities", async () => {
  // 準備
  const { decodeEntities } = await loadFlowchart();
  // 実行
  const text = decodeEntities("#quot;a#quot; #91;b#93; #35;1 #amp; #x; #");
  // 検証
  expect(text).toBe('"a" [b] #1 & #x; #');
});

// 許さないリンク先だけを項目にする（正常系）
test("test_map_link_problems", async () => {
  // 準備
  const { mapLinkProblems } = await loadFlowchart();
  // 実行
  const result = mapLinkProblems({
    links: {
      a: "https://example.com/spec",
      b: "./other.md",
      c: "mailto:a@example.com",
      d: "javascript:alert(1)",
      e: "id:spec#items",
    },
    idLinks: { mode: "resolve", resolveIdLink: undefined },
  });
  // 検証
  expect(result.allowed).toEqual({
    a: "https://example.com/spec",
    b: "./other.md",
    c: "mailto:a@example.com",
  });
  expect(result.problems).toHaveLength(2);
  expect(result.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
    "map_invalid_value",
  ]);
  for (const [problem, text] of [
    [result.problems[0], "d: javascript:alert(1)"],
    [result.problems[1], "e: id:spec#items"],
  ] as const) {
    expect(problem?.message).toContain(
      "ノードのリンク先に使用できないものがあります。使用できるリンク先は http・https・mailto と相対パスです。このノードはリンクにせずに描いています。",
    );
    expect(problem?.message).toContain(text);
  }
});

// id: のリンク先（正常系）
test("test_map_link_problems_when_id_links", async () => {
  // 準備
  const { mapLinkProblems } = await loadFlowchart();
  const links = { a: "id:SC-1", b: "id:unknown" };
  const resolveIdLink = (href: string) =>
    href.startsWith("id:SC-")
      ? `https://docs.example.com/${href.slice("id:".length)}`
      : undefined;
  // 実行
  const resolved = mapLinkProblems({
    links,
    idLinks: { mode: "resolve", resolveIdLink },
  });
  const skipped = mapLinkProblems({ links, idLinks: { mode: "skip" } });
  // 検証
  expect(resolved.allowed).toEqual({ a: "https://docs.example.com/SC-1" });
  expect(resolved.problems).toHaveLength(1);
  expect(resolved.problems[0]?.message).toContain("b: id:unknown");
  expect(skipped.allowed).toEqual({});
  expect(skipped.problems).toEqual([]);
});

// mermaid の形状の記法を読み取る（正常系）
test("test_parse_flowchart_when_mermaid_shapes", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  const source = [
    "flowchart TB",
    "  L[/入力/]",
    "  M[\\出力\\]",
    "  N[/台形\\]",
    "  O(((終了)))",
    '  P@{ shape: doc, label: "文書" }',
    '  Q@{ shape: cyl, label: "DB" }',
    '  R@{ icon: "fa:user", form: "square", label: "User", pos: "t", h: 60 }',
    '  S["`太字 **cat**`"]',
  ].join("\n");
  // 実行
  const chart = parseFlowchart(source);
  // 検証
  expect(chart.problems).toEqual([]);
  expect(chart.nodes.map((node) => node.shape)).toEqual([
    "lean-right",
    "lean-left",
    "trapezoid",
    "double-circle",
    "doc",
    "cylinder",
    "rect",
    "rect",
  ]);
  expect(chart.nodes.find((node) => node.id === "P")?.label).toBe("文書");
  expect(chart.nodes.find((node) => node.id === "R")?.label).toBe("User");
});

// 線の端・見えない線・線の長さ・線の属性の行を読み取る（正常系）
test("test_parse_flowchart_when_mermaid_edges", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  const source = [
    "flowchart LR",
    "  A --o B",
    "  A --x C",
    "  D o--o E",
    "  F x--x G",
    "  H ~~~ I",
    "  J ---->|No| K",
    "  J -- No ----> L",
    "  M e1@--> N",
    "  e1@{ animate: true }",
  ].join("\n");
  // 実行
  const chart = parseFlowchart(source);
  const edge = (id: string) => chart.edges.find((item) => item.id === id);
  // 検証
  expect(chart.problems).toEqual([]);
  expect(edge("A->B")?.ends).toEqual({ to: "circle" });
  expect(edge("A->C")?.ends).toEqual({ to: "cross" });
  expect(edge("D->E")?.ends).toEqual({ from: "circle", to: "circle" });
  expect(edge("F->G")?.ends).toEqual({ from: "cross", to: "cross" });
  expect(edge("H->I")?.invisible).toBe(true);
  expect(edge("J->K")).toMatchObject({ length: 3, label: "No" });
  expect(edge("J->L")).toMatchObject({ length: 3, label: "No" });
  expect(edge("e1")).toBeDefined();
});

// style・classDef・class・:::・linkStyle を styles に読み取る（正常系）
test("test_parse_flowchart_when_styles", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  const source = [
    "flowchart LR",
    "  A[要望を受ける] --> B{対応するか}",
    "  B -->|する| C[計画へ記載する]",
    "  B -->|しない| D[理由を返却する]",
    "  B -->|保留| E[後で決める]",
    "  style A fill:#f9f,stroke:#c3c",
    "  classDef warn fill:#ffe08a,stroke:#b8860b",
    "  class D warn",
    "  E:::warn",
    "  linkStyle 1 stroke:#d33",
  ].join("\n");
  // 実行
  const chart = parseFlowchart(source);
  // 検証
  expect(chart.problems).toEqual([]);
  expect(chart.styles.nodes.A).toEqual({ fill: "#f9f", stroke: "#c3c" });
  expect(chart.styles.nodes.D).toEqual({ fill: "#ffe08a", stroke: "#b8860b" });
  expect(chart.styles.nodes.E).toEqual({ fill: "#ffe08a", stroke: "#b8860b" });
  expect(chart.styles.wires[1]).toEqual({ stroke: "#d33" });
});
