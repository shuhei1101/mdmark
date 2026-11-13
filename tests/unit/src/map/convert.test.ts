import { expect, test } from "vitest";
import { parseMapData } from "../../../../src/map/data.ts";
import { parseFlowchart } from "../../../../src/map/flowchart.ts";
import { parseSequence } from "../../../../src/map/sequence.ts";
import {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  JUDGEMENT_TEXT,
} from "../../helpers/retired-diagrams.ts";
import {
  RETIRED_DOCUMENT,
  RETIRED_DOCUMENT_CONVERTED,
  RETIRED_KINDS,
  RETIRED_LINES,
} from "../../helpers/retired-document.ts";

/** 廃止した図の書き換えを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadConvert = () => import("../../../../src/map/convert.ts");

/** 範囲の行から、mermaid のブロックの中身と補足の JSON を取り出す */
const rangeParts = (lines: string[]): { mermaid: string; data: string } => {
  const start = lines.indexOf("```mermaid");
  const end = lines.indexOf("```", start + 1);
  const dataLine = lines.find((line) => line.startsWith("<!-- map-data: "));
  return {
    mermaid: lines.slice(start + 1, end).join("\n"),
    data: (dataLine ?? "").replace(/^<!-- map-data: /, "").replace(/ -->$/, ""),
  };
};

/** 廃止した図の範囲の文書にする */
const retiredRange = (directive: string, json: string, args = ""): string =>
  [
    `<!-- ${directive}${args} -->`,
    "",
    "```json",
    json,
    "```",
    "",
    `<!-- /${directive} -->`,
  ].join("\n");

// フロー図 2 つとシーケンス図を map の範囲にし、写さない値を報告に挙げる（正常系）
test("test_convert_retired_diagrams", async () => {
  // 準備
  const { convertRetiredDiagrams } = await loadConvert();
  const lines = RETIRED_DOCUMENT.split("\n");
  const firstFlow = lines.indexOf("<!-- flow -->") + 1;
  const secondFlow = lines.indexOf("<!-- flow -->", firstFlow) + 1;
  const sequence = lines.indexOf("<!-- sequence -->") + 1;
  // 実行
  const result = convertRetiredDiagrams({
    markdown: RETIRED_DOCUMENT,
    skip: new Set(),
  });
  // 検証
  expect(result.markdown).toBe(RETIRED_DOCUMENT_CONVERTED);
  expect(
    result.report.map((line) => [line.line, line.name, line.item]),
  ).toEqual([
    [firstFlow, "flow", "scope: メールの受け取りから返信まで"],
    [firstFlow, "flow", "updated: 2026-11-01"],
    [firstFlow, "flow", "stickyTitles: false"],
    [secondFlow, "flow", "scope: 問い合わせを受け取ったとき"],
    [secondFlow, "flow", "updated: 2026-11-02"],
    [sequence, "sequence", "scope: 依頼から回答まで"],
    [sequence, "sequence", "updated: 2026-11-03"],
  ]);
  for (const line of result.report) {
    expect(line.reason).not.toBe("");
  }
  expect(result.kinds).toEqual(RETIRED_KINDS);
  expect(result.lines).toEqual(RETIRED_LINES);
});

// 読めない定義の範囲を書き換えずに報告に挙げる（異常系）
test("test_convert_retired_diagrams_when_unreadable", async () => {
  // 準備
  const { convertRetiredDiagrams } = await loadConvert();
  const broken = retiredRange("flow", '{ "title": "壊れた図", "nodes": [');
  const markdown = [
    "# 文書",
    "",
    broken,
    "",
    retiredRange("sequence", INQUIRY_SEQ_TEXT),
    "",
  ].join("\n");
  // 実行
  const result = convertRetiredDiagrams({ markdown, skip: new Set() });
  // 検証
  expect(result.markdown.startsWith(`# 文書\n\n${broken}\n\n<!-- map: `)).toBe(
    true,
  );
  expect(result.markdown).not.toContain("<!-- sequence -->");
  const unreadable = result.report.filter((line) => line.line === 3);
  expect(unreadable).toHaveLength(1);
  expect(unreadable[0]?.name).toBe("flow");
  expect(unreadable[0]?.reason).toContain("JSON として読み込めません");
});

// 拡張の名前の範囲を書き換えない（正常系）
test("test_convert_retired_diagrams_when_skipped", async () => {
  // 準備
  const { convertRetiredDiagrams } = await loadConvert();
  const markdown = `${retiredRange("flow", INQUIRY_TEXT, ': {"target": "world"}')}\n`;
  // 実行
  const result = convertRetiredDiagrams({ markdown, skip: new Set(["flow"]) });
  // 検証
  expect(result.markdown).toBe(markdown);
  expect(result.report).toEqual([]);
});

// コードブロックの中の範囲を書き換えない（正常系）
test("test_convert_retired_diagrams_when_in_code", async () => {
  // 準備
  const { convertRetiredDiagrams } = await loadConvert();
  const markdown = [
    "````markdown",
    retiredRange("flow", INQUIRY_TEXT),
    "````",
    "",
  ].join("\n");
  // 実行
  const result = convertRetiredDiagrams({ markdown, skip: new Set() });
  // 検証
  expect(result.markdown).toBe(markdown);
});

// 書き換えた本文にもう一度適用しても変わらない（正常系）
test("test_convert_retired_diagrams_when_rerun", async () => {
  // 準備
  const { convertRetiredDiagrams } = await loadConvert();
  const first = convertRetiredDiagrams({
    markdown: RETIRED_DOCUMENT,
    skip: new Set(),
  });
  // 実行
  const result = convertRetiredDiagrams({
    markdown: first.markdown,
    skip: new Set(),
  });
  // 検証
  expect(result.markdown).toBe(first.markdown);
  expect(result.report).toEqual([]);
});

// 今の図の見本の定義を読める（正常系）
test("test_read_retired_definition", async () => {
  // 準備
  const { readRetiredDefinition } = await loadConvert();
  // 実行
  const results = [
    readRetiredDefinition("flow", [INQUIRY_TEXT]),
    readRetiredDefinition("sequence", [INQUIRY_SEQ_TEXT]),
    readRetiredDefinition("flow", [JUDGEMENT_TEXT]),
  ];
  // 検証
  for (const result of results) {
    expect(result.ok).toBe(true);
  }
});

// 線の端が無いノードを指す（異常系）
test("test_read_retired_definition_when_wire_end_missing", async () => {
  // 準備
  const { readRetiredDefinition } = await loadConvert();
  const definition = JSON.parse(INQUIRY_TEXT) as {
    wires: Array<Record<string, unknown>>;
  };
  definition.wires = definition.wires.map((wire) =>
    wire.id === "w-mail" ? { ...wire, to: "recieve" } : wire,
  );
  // 実行
  const result = readRetiredDefinition("flow", [JSON.stringify(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.ok ? "" : result.reason).toContain("recieve");
});

// 枠と層を入れ子のグループにし、種類と説明とリンクを写す（正常系）
test("test_flow_to_map", async () => {
  // 準備
  const { flowToMap, readRetiredDefinition } = await loadConvert();
  const source = JSON.parse(INQUIRY_TEXT) as {
    nodes: Array<Record<string, unknown>>;
  };
  source.nodes.push({
    id: "spec",
    kind: "external",
    x: 976,
    y: 360,
    w: 112,
    h: 64,
    name: "仕様",
    hint: "仕様の文書",
    href: "https://example.com/spec",
  });
  const read = readRetiredDefinition("flow", [JSON.stringify(source)]);
  if (!read.ok) throw new Error(read.reason);
  // 実行
  const result = flowToMap(read.definition as never);
  // 検証
  const { mermaid, data } = rangeParts(result.lines);
  const chart = parseFlowchart(mermaid);
  const parsed = parseMapData(data);
  expect(chart.problems).toEqual([]);
  expect(parsed.problems).toEqual([]);
  expect(chart.groups.find((group) => group.id === "frame")?.parent).toBe(
    undefined,
  );
  expect(chart.groups.filter((group) => group.parent === "frame")).toHaveLength(
    3,
  );
  for (const id of ["mail", "chat", "spec"]) {
    expect(chart.nodes.find((node) => node.id === id)?.parent).toBe(undefined);
  }
  expect(chart.nodes.find((node) => node.id === "draft")?.classes).toEqual([
    "llm",
  ]);
  expect(parsed.data.layout["faq->draft"]?.line).toBe("read");
  expect(parsed.data.layout["recv->table"]?.line).toBe("write");
  expect(parsed.data.notes.recv?.text).toContain("入力: 問い合わせのメール");
  expect(parsed.data.notes.spec?.text).toBe("仕様の文書");
  expect(parsed.data.notes["mail->recv"]?.text).toBe(
    "件名・本文・送信者のアドレス",
  );
  expect(chart.links).toEqual({ spec: "https://example.com/spec" });
});

// 判定フローチャートのノードを種類ごとの形にする（正常系）
test("test_flow_to_map_when_judgement", async () => {
  // 準備
  const { flowToMap, readRetiredDefinition } = await loadConvert();
  const read = readRetiredDefinition("flow", [JUDGEMENT_TEXT]);
  if (!read.ok) throw new Error(read.reason);
  // 実行
  const result = flowToMap(read.definition as never);
  // 検証
  const chart = parseFlowchart(rangeParts(result.lines).mermaid);
  const shapeOf = (id: string) =>
    chart.nodes.find((node) => node.id === id)?.shape;
  expect(shapeOf("start")).toBe("stadium");
  expect(shapeOf("q0")).toBe("rhombus");
  expect(shapeOf("a1")).toBe("rect");
  expect(shapeOf("r1")).toBe("stadium");
  expect(
    chart.edges.flatMap((edge) =>
      edge.label === undefined ? [] : [edge.label],
    ),
  ).toEqual(["YES", "NO", "YES", "NO"]);
  expect([...result.kinds].sort()).toEqual([
    "action",
    "question",
    "result",
    "start",
  ]);
});

// map で読めない id と予約語の id を置き換える（正常系）
test("test_flow_to_map_when_id_unreadable", async () => {
  // 準備
  const { flowToMap, readRetiredDefinition } = await loadConvert();
  const read = readRetiredDefinition("flow", [
    JSON.stringify({
      title: "置き換え",
      nodes: [
        { id: "web-api", kind: "script", name: "API" },
        { id: "end", kind: "result", name: "終わり", href: "./end.md" },
        { id: "n1", kind: "script", name: "既にある" },
      ],
      wires: [
        { id: "w", from: "web-api", to: "end", line: "flow", tip: "応答" },
      ],
    }),
  ]);
  if (!read.ok) throw new Error(read.reason);
  // 実行
  const result = flowToMap(read.definition as never);
  // 検証
  const { mermaid, data } = rangeParts(result.lines);
  const chart = parseFlowchart(mermaid);
  const parsed = parseMapData(data);
  expect(chart.problems).toEqual([]);
  expect(parsed.problems).toEqual([]);
  expect(chart.nodes.map((node) => node.id).sort()).toEqual(["n1", "n2", "n3"]);
  expect(chart.edges.map((edge) => [edge.from, edge.to])).toEqual([
    ["n2", "n3"],
  ]);
  expect(Object.keys(parsed.data.notes)).toEqual(["n2->n3"]);
  expect(chart.links).toEqual({ n3: "./end.md" });
  expect(result.dropped).toContain("id web-api → n2");
  expect(result.dropped).toContain("id end → n3");
});

// Mermaid の記号を持つ名前を文字の参照にする（異常系）
test("test_flow_to_map_when_name_has_symbols", async () => {
  // 準備
  const { flowToMap, readRetiredDefinition } = await loadConvert();
  const read = readRetiredDefinition("flow", [
    JSON.stringify({
      title: "記号",
      nodes: [{ id: "a", kind: "script", name: '"a" [b]' }],
      wires: [],
    }),
  ]);
  if (!read.ok) throw new Error(read.reason);
  // 実行
  const result = flowToMap(read.definition as never);
  // 検証
  const chart = parseFlowchart(rangeParts(result.lines).mermaid);
  expect(chart.problems).toEqual([]);
  expect(chart.nodes[0]?.label).toBe('"a" [b]');
});

// 相手とメッセージと繰り返しを写す（正常系）
test("test_sequence_to_map", async () => {
  // 準備
  const { sequenceToMap, readRetiredDefinition } = await loadConvert();
  const read = readRetiredDefinition("sequence", [INQUIRY_SEQ_TEXT]);
  if (!read.ok) throw new Error(read.reason);
  // 実行
  const result = sequenceToMap(read.definition as never);
  // 検証
  const { mermaid, data } = rangeParts(result.lines);
  const sequence = parseSequence(mermaid);
  const parsed = parseMapData(data);
  expect(sequence.problems).toEqual([]);
  expect(sequence.participants.map((item) => item.id)).toEqual([
    "mail",
    "recv",
    "classify",
    "draft",
    "mcp",
  ]);
  expect(sequence.messages).toHaveLength(6);
  expect(mermaid).toContain("classify-->>recv: 返信の種類");
  expect(mermaid).toContain("mcp-->>draft: 保存した下書きの ID");
  expect(sequence.fragments).toHaveLength(1);
  expect(sequence.fragments[0]).toMatchObject({
    kind: "loop",
    start: 0,
    end: 6,
  });
  expect(parsed.data.notes["1"]?.text).toBe("件名・本文・送信者のアドレス");
  expect(parsed.data.notes["4"]?.text).toBe(
    "本文・返信の種類・回答の候補 3 件",
  );
});

// map で読めない相手の id を置き換える（正常系）
test("test_sequence_to_map_when_id_unreadable", async () => {
  // 準備
  const { sequenceToMap, readRetiredDefinition } = await loadConvert();
  const read = readRetiredDefinition("sequence", [
    JSON.stringify({
      title: "置き換え",
      participants: [
        { id: "web-api", kind: "script", name: "API" },
        { id: "end", kind: "data", name: "記録" },
      ],
      steps: [{ from: "web-api", to: "end", label: "書く" }],
    }),
  ]);
  if (!read.ok) throw new Error(read.reason);
  // 実行
  const result = sequenceToMap(read.definition as never);
  // 検証
  const sequence = parseSequence(rangeParts(result.lines).mermaid);
  expect(sequence.problems).toEqual([]);
  expect(sequence.participants.map((item) => item.id)).toEqual(["p1", "p2"]);
  expect(sequence.messages.map((item) => [item.from, item.to])).toEqual([
    ["p1", "p2"],
  ]);
  expect(result.dropped.filter((item) => item.startsWith("id "))).toHaveLength(
    2,
  );
});
