import { expect, test } from "vitest";
import type { MdmarkChartDefinition } from "../../../../src/diagram/definition.ts";
import {
  ADDED_CHART_DEFINITIONS,
  INQUIRY_COUNT_TEXT,
  LENGTH_TIME_TEXT,
  REPLY_KIND_TEXT,
} from "../../helpers/charts.ts";
import {
  parsed,
  REPLY_TIME_TEXT,
  STRENGTH_TEXT,
} from "../../helpers/diagrams.ts";
import {
  erText,
  shopEr,
  shopErColors,
  shopErFolded,
} from "../../helpers/er.ts";

/** 定義の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDefinition = () => import("../../../../src/diagram/definition.ts");

// 読み込める JSON は値を返却する（正常系）
test("test_parse_definition_json", async () => {
  // 準備
  const { parseDefinitionJson } = await loadDefinition();
  // 実行
  const result = parseDefinitionJson('{"title": "a"}');
  // 検証
  expect(result).toMatchObject({ ok: true, value: { title: "a" } });
});

// 閉じの } が無い JSON は読み込めない行・読み込めた最後の部分・足りない記号を返却する（異常系）
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

// モックの見本の定義を読み込める（正常系）
test("test_read_definition", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const results = [
    readDefinition("chart", [REPLY_TIME_TEXT]),
    readDefinition("param", [STRENGTH_TEXT]),
  ];
  // 検証
  for (const result of results) {
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  }
});

// グラフの種類が使用できないときは使用できる種類を示す（異常系）
test("test_read_definition_when_kind_unknown", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const definition = {
    ...parsed<MdmarkChartDefinition>(REPLY_TIME_TEXT),
    type: "robot",
  };
  // 実行
  const result = readDefinition("chart", [JSON.stringify(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.problems[0]).toContain("robot");
  expect(result.problems[0]).toMatch(
    /使用できる種類は [a-z-]+(・[a-z-]+)+ です/,
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

// json のコードブロックが 0 つ・2 つのときは 1 つだけ配置するよう示す（異常系）
test("test_read_definition_when_blocks_count", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const none = readDefinition("chart", []);
  const two = readDefinition("chart", [REPLY_TIME_TEXT, REPLY_TIME_TEXT]);
  // 検証
  for (const result of [none, two]) {
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain(
      "マーカーの範囲に json のコードブロックを 1 つだけ配置してください",
    );
  }
});

// 棒・円・散布図のモックの見本を読み込める（正常系）
test("test_read_definition_when_chart_types", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const results = [
    readDefinition("chart", [INQUIRY_COUNT_TEXT]),
    readDefinition("chart", [REPLY_KIND_TEXT]),
    readDefinition("chart", [LENGTH_TIME_TEXT]),
  ];
  // 検証
  for (const result of results) {
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  }
});

// 種類に合わない項目を読み込めない箇所にする（異常系）
test("test_read_definition_when_chart_shape_mismatch", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const base = { title: "タイトル", scope: "範囲", updated: "2026-10-17" };
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

// 追加したグラフの種類の定義を読み込める（正常系）
test("test_read_definition_when_chart_types_added", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const results = ADDED_CHART_DEFINITIONS.map((definition) =>
    readDefinition("chart", [JSON.stringify(definition)]),
  );
  // 検証
  expect(results).toHaveLength(9);
  for (const result of results) {
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  }
});

// 系列と項目の 7 つ以上を読み込めない箇所にする（異常系）
test("test_read_definition_when_chart_series_too_many", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const base = { title: "タイトル", scope: "範囲", updated: "2026-11-03" };
  const sevenSeries = {
    ...base,
    type: "line",
    x: { label: "横", ticks: ["a", "b"] },
    y: { label: "縦" },
    series: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      name: `系列${n}`,
      points: [n, n],
    })),
  };
  const sevenItems = {
    ...base,
    type: "donut",
    items: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `項目${n}`, value: n })),
  };
  // 実行
  const line = readDefinition("chart", [JSON.stringify(sevenSeries)]);
  const donut = readDefinition("chart", [JSON.stringify(sevenItems)]);
  // 検証
  for (const [result, word] of [
    [line, "系列"],
    [donut, "項目"],
  ] as const) {
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain(word);
    expect(result.problems[0]).toContain("7");
    expect(result.problems[0]).toContain("6 つ");
  }
});

// バブルの点の形状を確認する（異常系）
test("test_read_definition_when_bubble_point", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const bubble = {
    title: "タイトル",
    scope: "範囲",
    updated: "2026-11-03",
    type: "bubble",
    x: { label: "横" },
    y: { label: "縦" },
    size: { label: "件数" },
    series: [{ name: "系列", points: [[1, 2]] }],
  };
  // 実行
  const result = readDefinition("chart", [JSON.stringify(bubble)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.problems[0]).toContain("[x, y, size]");
});

// ER 図のモックの見本を読み込める（正常系）
test("test_read_definition_when_er", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  // 実行
  const results = [shopEr(), shopErColors(), shopErFolded()].map((d) =>
    readDefinition("er", [erText(d)]),
  );
  // 検証
  for (const result of results) {
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  }
});

// 関係がテーブルに無い列を指す（異常系）
test("test_read_definition_when_er_column_missing", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const definition = shopEr();
  definition.relations = definition.relations.map((r) =>
    r.label === "注文する" ? { ...r, toColumn: "customer" } : r,
  );
  // 実行
  const result = readDefinition("er", [erText(definition)]);
  // 検証
  expect(result.ok).toBe(false);
  expect(result.problems[0]).toBe(
    "関係「注文する」の先の列 orders.customer がテーブル orders にありません",
  );
});

// テーブルの id・列の名前の重なりと、使用できない種類・色・多重度（異常系）
test("test_read_definition_when_er_invalid_values", async () => {
  // 準備
  const { readDefinition } = await loadDefinition();
  const withTables = (map: (d: ReturnType<typeof shopEr>) => void) => {
    const d = shopEr();
    map(d);
    return erText(d);
  };
  const cases: Array<[string, string[]]> = [
    [
      withTables((d) => {
        const products = d.tables[3];
        if (products) {
          products.id = "orders";
        }
      }),
      ["orders"],
    ],
    [
      withTables((d) => {
        d.tables[0]?.columns.push({ name: "email", type: "text" });
      }),
      ["email"],
    ],
    [
      withTables((d) => {
        Object.assign(d.tables[0] ?? {}, { kind: "view" });
      }),
      ["master・transaction"],
    ],
    [
      withTables((d) => {
        Object.assign(d.tables[0] ?? {}, { color: "pink" });
      }),
      ["blue・red・green・yellow・orange・purple・gray"],
    ],
    [
      withTables((d) => {
        Object.assign(d.relations[0] ?? {}, { toCard: "many" });
      }),
      ["1・0..1・1..n・0..n"],
    ],
  ];
  // 実行
  const results = cases.map(([text]) => readDefinition("er", [text]));
  // 検証
  results.forEach((result, i) => {
    expect(result.ok, String(i)).toBe(false);
    for (const word of cases[i]?.[1] ?? []) {
      expect(result.problems[0], String(i)).toContain(word);
    }
  });
});
