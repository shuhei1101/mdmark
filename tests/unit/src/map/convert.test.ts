import { expect, test } from "vitest";
import { parseMapData } from "../../../../src/map/data.ts";
import { parseErDiagram } from "../../../../src/map/er.ts";
import { parseFlowchart } from "../../../../src/map/flowchart.ts";
import { parseSequence } from "../../../../src/map/sequence.ts";
import {
  erText,
  shopEr,
  shopErColors,
  shopErFolded,
} from "../../helpers/er.ts";
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
import {
  RETIRED_ER_DEFINITION,
  RETIRED_ER_DOCUMENT,
  RETIRED_ER_DOCUMENT_CONVERTED,
  RETIRED_ER_LINE,
  RETIRED_ER_REPORT_ITEMS,
} from "../../helpers/retired-er-document.ts";

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
  expect(parsed.data.notes.recv?.text).toMatch(
    /^1 通ずつ読み込む\n入力: 問い合わせのメール/,
  );
  expect(chart.nodes.find((node) => node.id === "classify")?.label).toBe(
    "意思決定モデル\n分類",
  );
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

// ER 図の部品の範囲を書き換えず、報告にも挙げない（正常系）
test("test_convert_retired_diagrams_when_er", async () => {
  // 準備
  const { convertRetiredDiagrams } = await loadConvert();
  // 実行
  const result = convertRetiredDiagrams({
    markdown: RETIRED_ER_DOCUMENT,
    skip: new Set(),
  });
  // 検証
  expect(result.markdown).toBe(RETIRED_ER_DOCUMENT);
  expect(result.report).toEqual([]);
});

// ER 図の部品の範囲を map の範囲にし、写さない値を報告に挙げる（正常系）
test("test_convert_retired_er", async () => {
  // 準備
  const { convertRetiredEr } = await loadConvert();
  // 実行
  const result = convertRetiredEr({
    markdown: RETIRED_ER_DOCUMENT,
    skip: new Set(),
  });
  // 検証
  expect(result.markdown).toBe(RETIRED_ER_DOCUMENT_CONVERTED);
  expect(
    result.report.map((line) => [line.line, line.name, line.item]),
  ).toEqual(
    RETIRED_ER_REPORT_ITEMS.map((item) => [RETIRED_ER_LINE, "er", item]),
  );
  for (const line of result.report) {
    expect(line.reason).not.toBe("");
    expect(line.item).not.toMatch(/^(x|y|w|width|midX)\b|\.(x|y|w):/);
  }
});

// 読めない・記法で記載できない・物理名が重なる範囲を書き換えずに報告に挙げる（異常系）
test("test_convert_retired_er_when_unconvertible", async () => {
  // 準備
  const { convertRetiredEr } = await loadConvert();
  const base = RETIRED_ER_DEFINITION;
  const missing = {
    ...base,
    relations: [
      ...base.relations,
      {
        from: "o",
        fromColumn: "id",
        fromCard: "1",
        to: "payments",
        toColumn: "order_id",
        toCard: "0..n",
      },
    ],
  };
  const spaced = {
    ...base,
    tables: base.tables.map((table) =>
      table.id === "o"
        ? {
            ...table,
            columns: [
              ...table.columns,
              { name: "paid_at", type: "timestamp with time zone" },
            ],
          }
        : table,
    ),
  };
  const duplicated = {
    ...base,
    tables: base.tables.map((table) =>
      table.id === "i" ? { ...table, name: "orders" } : table,
    ),
  };
  const ranges = [missing, spaced, duplicated, base].map((definition) =>
    retiredRange("er", JSON.stringify(definition, null, 2)),
  );
  const markdown = `${ranges.join("\n\n")}\n`;
  const lines = markdown.split("\n");
  const starts = lines.flatMap((line, index) =>
    line === "<!-- er -->" ? [index + 1] : [],
  );
  // 実行
  const result = convertRetiredEr({ markdown, skip: new Set() });
  // 検証
  for (const range of ranges.slice(0, 3)) {
    expect(result.markdown).toContain(range);
  }
  expect(result.markdown).not.toContain(ranges[3]);
  expect(result.markdown).toContain('<!-- map: {"title": "注文のデータ"} -->');
  const skipped = starts
    .slice(0, 3)
    .map((start) =>
      result.report.filter(
        (line) => line.line === start && line.item === "範囲",
      ),
    );
  expect(skipped.map((items) => items.length)).toEqual([1, 1, 1]);
  expect(skipped[0]?.[0]?.reason).toContain("payments");
  expect(skipped[1]?.[0]?.reason).toContain("timestamp with time zone");
  expect(skipped[2]?.[0]?.reason).toContain("orders");
});

// 拡張の名前の範囲と、flow・sequence の範囲を書き換えない（正常系）
test("test_convert_retired_er_when_skipped", async () => {
  // 準備
  const { convertRetiredEr } = await loadConvert();
  const markdown = [
    retiredRange("er", erText(shopEr())),
    "",
    retiredRange("flow", INQUIRY_TEXT),
    "",
  ].join("\n");
  // 実行
  const result = convertRetiredEr({ markdown, skip: new Set(["er"]) });
  // 検証
  expect(result.markdown).toBe(markdown);
  expect(result.report).toEqual([]);
});

// 書き換えた本文にもう一度適用しても変わらない（正常系）
test("test_convert_retired_er_when_rerun", async () => {
  // 準備
  const { convertRetiredEr } = await loadConvert();
  const first = convertRetiredEr({
    markdown: RETIRED_ER_DOCUMENT,
    skip: new Set(),
  });
  // 実行
  const result = convertRetiredEr({
    markdown: first.markdown,
    skip: new Set(),
  });
  // 検証
  expect(result.markdown).toBe(first.markdown);
  expect(result.report).toEqual([]);
});

// 今の ER 図の見本の定義を読める（正常系）
test("test_read_retired_er_definition", async () => {
  // 準備
  const { readRetiredErDefinition } = await loadConvert();
  // 実行
  const results = [shopEr(), shopErColors(), shopErFolded()].map((definition) =>
    readRetiredErDefinition([erText(definition)]),
  );
  // 検証
  for (const result of results) {
    expect(result.ok).toBe(true);
  }
});

// 関係がテーブルに無い列を指す（異常系）
test("test_read_retired_er_definition_when_column_missing", async () => {
  // 準備
  const { readRetiredErDefinition } = await loadConvert();
  const definition = shopEr();
  definition.relations = definition.relations.map((relation) =>
    relation.label === "注文する"
      ? { ...relation, toColumn: "customer" }
      : relation,
  );
  // 実行
  const result = readRetiredErDefinition([erText(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.ok ? "" : result.reason).toContain("orders.customer");
});

// テーブル・列・関係・説明・畳んだテーブルを写す（正常系）
test("test_er_to_map", async () => {
  // 準備
  const { erToMap, readRetiredErDefinition } = await loadConvert();
  const read = readRetiredErDefinition([erText(shopErFolded())]);
  if (!read.ok) throw new Error(read.reason);
  // 実行
  const result = erToMap(read.definition, 1);
  // 検証
  if (!result.ok) throw new Error(result.reason);
  expect(result.lines[0]).toBe('<!-- map: {"title": "注文のデータ"} -->');
  const { mermaid, data } = rangeParts(result.lines);
  const diagram = parseErDiagram(mermaid);
  const parsed = parseMapData(data);
  expect(diagram.problems).toEqual([]);
  expect(parsed.problems).toEqual([]);
  expect(diagram.tables.map((table) => table.name)).toEqual([
    "customers",
    "orders",
    "order_items",
    "products",
  ]);
  expect(
    diagram.tables
      .find((table) => table.name === "order_items")
      ?.columns.map((column) => [column.type, column.name, column.keys]),
  ).toEqual([
    ["bigint", "order_id", ["PK", "FK"]],
    ["bigint", "product_id", ["PK", "FK"]],
    ["integer", "quantity", []],
    ["integer", "unit_price", []],
  ]);
  expect(
    diagram.relations.map((relation) => [
      relation.from,
      relation.fromCardinality,
      relation.to,
      relation.toCardinality,
      relation.label,
    ]),
  ).toEqual([
    ["customers", "1", "orders", "0..n", "注文する"],
    ["orders", "1", "order_items", "1..n", "含む"],
    ["products", "1", "order_items", "0..n", "注文される"],
  ]);
  expect(parsed.data.notes.customers?.text).toBe(
    "顧客\n注文する人。メールアドレスで一意にする",
  );
  expect(parsed.data.notes.order_items?.text).toBe("注文の明細");
  expect(parsed.data.notes["orders.customer_id"]?.text).toBe("注文した顧客");
  expect(parsed.data.layout.orders?.collapsed).toBe(true);
  expect(parsed.data.layout.customers?.collapsed).toBe(undefined);
});

// 記法で記載できない値と物理名の重なり（異常系）
test("test_er_to_map_when_unwritable", async () => {
  // 準備
  const { erToMap, readRetiredErDefinition } = await loadConvert();
  const spacedName = shopEr();
  spacedName.tables = spacedName.tables.map((table) =>
    table.id === "products" ? { ...table, name: "sale items" } : table,
  );
  const quotedDesc = shopEr();
  quotedDesc.tables = quotedDesc.tables.map((table) =>
    table.id === "orders"
      ? {
          ...table,
          columns: table.columns.map((column) =>
            column.name === "note"
              ? { ...column, desc: '"自由記入" の欄' }
              : column,
          ),
        }
      : table,
  );
  const duplicated = shopEr();
  duplicated.tables = duplicated.tables.map((table) =>
    table.id === "products" ? { ...table, name: "orders" } : table,
  );
  // 実行
  const results = [spacedName, quotedDesc, duplicated].map((definition) => {
    const read = readRetiredErDefinition([erText(definition)]);
    if (!read.ok) throw new Error(read.reason);
    return erToMap(read.definition, 1);
  });
  // 検証
  const reasons = results.map((result) => (result.ok ? "" : result.reason));
  expect(results.map((result) => result.ok)).toEqual([false, false, false]);
  expect(reasons[0]).toContain("sale items");
  expect(reasons[1]).toContain('"自由記入" の欄');
  expect(reasons[2]).toContain("orders");
});
