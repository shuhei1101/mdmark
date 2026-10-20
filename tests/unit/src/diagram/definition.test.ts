import { expect, test } from "vitest";
import type {
  MdmarkChartDefinition,
  MdmarkFlowDefinition,
} from "../../../../src/diagram/definition.ts";
import {
  INQUIRY_COUNT_TEXT,
  INQUIRY_HINT_TEXT,
  LENGTH_TIME_TEXT,
  REPLY_KIND_TEXT,
} from "../../helpers/charts.ts";
import {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  parsed,
  REPLY_TIME_TEXT,
  STRENGTH_TEXT,
} from "../../helpers/diagrams.ts";

/** 定義の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDefinition = () => import("../../../../src/diagram/definition.ts");

// 読める JSON は値を返す（正常系）
test("test_parse_definition_json", async () => {
  // 準備
  const { parseDefinitionJson } = await loadDefinition();
  // 実行
  const result = parseDefinitionJson('{"title": "a"}');
  // 検証
  expect(result).toMatchObject({ ok: true, value: { title: "a" } });
});

// 閉じの } が無い JSON は読めない行・読めた最後の部分・足りない記号を返す（異常系）
test("test_parse_definition_json_when_unclosed", async () => {
  // 準備
  const { parseDefinitionJson } = await loadDefinition();
  const keys = Array.from({ length: 9 }, (_, i) => `  "k${i}": ${i},`);
  const text = ["{", '  "title": "a",', ...keys, '  "label": "本文",'].join(
    "\n",
  );
  // 実行
  const result = parseDefinitionJson(text);
  // 検証
  expect(text.split("\n")).toHaveLength(12);
  expect(result).toEqual({
    ok: false,
    line: 12,
    after: '"label": "本文",',
    missing: "}",
  });
});

// モックの見本の定義を読める（正常系）
test("test_read_definition", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const results = [
    readDefinition("flow", [INQUIRY_TEXT]),
    readDefinition("sequence", [INQUIRY_SEQ_TEXT]),
    readDefinition("chart", [REPLY_TIME_TEXT]),
    readDefinition("param", [STRENGTH_TEXT]),
  ];
  // 検証
  for (const result of results) {
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  }
});

// 箱の種類が使えないときは使える種類を示す（異常系）
test("test_read_definition_when_kind_unknown", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  const third = definition.nodes[2];
  if (third === undefined) {
    throw new Error("見本の 3 つ目の箱が無い");
  }
  Object.assign(third, { kind: "robot" });
  // 実行
  const result = readDefinition("flow", [JSON.stringify(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.problems[0]).toBe(
    "箱「分類」の種類 robot は使えません。使える種類は llm・dm・script・mcp・data・external です",
  );
});

// 系列の点の数が横の目盛りと合わないときは数を示す（異常系）
test("test_read_definition_when_points_mismatch", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const definition = parsed<MdmarkChartDefinition>(REPLY_TIME_TEXT);
  const staff = definition.series?.find((series) => series.name === "担当者");
  if (staff === undefined) {
    throw new Error("見本の系列「担当者」が無い");
  }
  staff.points = staff.points.slice(0, 4);
  // 実行
  const result = readDefinition("chart", [JSON.stringify(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.problems[0]).toBe(
    "系列「担当者」の点が 4 つで、横の目盛り（x.ticks）の 5 つと合いません",
  );
});

// 線の端が無い箱を指すときは線と箱の id を示す（異常系）
test("test_read_definition_when_wire_end_missing", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  const wire = definition.wires.find((candidate) => candidate.id === "w-mail");
  if (wire === undefined) {
    throw new Error("見本の線 w-mail が無い");
  }
  wire.to = "recieve";
  // 実行
  const result = readDefinition("flow", [JSON.stringify(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.problems[0]).toBe(
    "線 w-mail の端の箱 recieve がありません。箱の id で書いてください",
  );
});

// 箱の id が重なるときは重なった id を示す（異常系）
test("test_read_definition_when_id_duplicated", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const box = { kind: "script", x: 0, y: 0, w: 100, h: 60 };
  const definition = {
    title: "重なる id",
    scope: "確かめ",
    updated: "2026-10-18",
    width: 300,
    height: 120,
    nodes: [
      { id: "recv", name: "受け取り", ...box },
      { id: "recv", name: "もう 1 つの受け取り", ...box },
    ],
    wires: [],
  };
  // 実行
  const result = readDefinition("flow", [JSON.stringify(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.problems[0]).toBe(
    "箱の id recv が 2 つあります。別の id にしてください",
  );
});

// json のコードブロックが 0 つ・2 つのときは 1 つだけ置くよう示す（異常系）
test("test_read_definition_when_blocks_count", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const none = readDefinition("flow", []);
  const two = readDefinition("flow", [INQUIRY_TEXT, INQUIRY_TEXT]);
  // 検証
  for (const result of [none, two]) {
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain(
      "印の範囲に json のコードブロックを 1 つだけ置いてください",
    );
  }
});

// 棒・円・散布図のモックの見本を読める（正常系）
test("test_read_definition_when_chart_types", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const results = [
    readDefinition("chart", [INQUIRY_COUNT_TEXT]),
    readDefinition("chart", [REPLY_KIND_TEXT]),
    readDefinition("chart", [LENGTH_TIME_TEXT]),
    readDefinition("flow", [INQUIRY_HINT_TEXT]),
  ];
  // 検証
  for (const result of results) {
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  }
});

// 種類に合わない項目を読めない箇所にする（異常系）
test("test_read_definition_when_chart_shape_mismatch", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const base = { title: "題", scope: "範囲", updated: "2026-10-17" };
  const pieWithoutItems = { ...base, type: "pie" };
  const scatterWithNumbers = {
    ...base,
    type: "scatter",
    x: { label: "横" },
    y: { label: "縦" },
    series: [{ name: "系列", points: [1, 2] }],
  };
  const yWithMinOnly = {
    ...base,
    x: { label: "横", ticks: ["a", "b"] },
    y: { label: "縦", min: 0 },
    series: [{ name: "系列", points: [1, 2] }],
  };
  // 実行
  const pie = readDefinition("chart", [JSON.stringify(pieWithoutItems)]);
  const scatter = readDefinition("chart", [JSON.stringify(scatterWithNumbers)]);
  const axis = readDefinition("chart", [JSON.stringify(yWithMinOnly)]);
  // 検証
  for (const result of [pie, scatter, axis]) {
    expect(result.ok).toBe(false);
  }
  expect(pie.problems[0]).toContain("items");
  expect(scatter.problems[0]).toContain("[x, y]");
  for (const name of ["min", "max", "step"]) {
    expect(axis.problems[0], name).toContain(name);
  }
});
