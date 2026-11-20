import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  BLOCK,
  CONFIG,
  DATA,
  FLOW,
  GANTT,
  TIMELINE,
  TIMELINE_DATA,
} from "../../helpers/map.ts";

/** map の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/map/check.ts");

/** `id:` のノードのリンク先を確かめない扱い */
const SKIP = { mode: "skip" } as const;

/** 範囲を 1 つの mermaid のブロックと補足で組み立てる */
const range = (mermaid: string, data?: string, args = "") => ({
  args,
  mermaid,
  mermaidCount: 1,
  data,
  dataCount: data === undefined ? 0 : 1,
});

// ずれの無い範囲（正常系）
test("test_collect_map_problems", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(range(FLOW, DATA), CONFIG, {
    includeUnknownKeys: true,
    idLinks: SKIP,
  });
  // 検証
  expect(problems).toEqual([]);
});

// 無い ID（異常系）
test("test_collect_map_problems_when_unknown_ref", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    range(FLOW, '{"version": 1, "notes": {"ghost": {"text": "無いノード"}}}'),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_unknown_ref"]);
  expect(problems[0]?.message).toContain("notes.ghost");
});

// グループの ID を指す notes をずれにしない（正常系）
test("test_collect_map_problems_when_group_note", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    range(
      FLOW,
      '{"version": 1, "notes": {"lib": {"text": "記法を読み取る部分"}}}',
    ),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems).toEqual([]);
});

// 許さないノードのリンク先（異常系）
test("test_collect_map_problems_when_link_not_allowed", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    range('flowchart LR\n  a --> b\n  click a "javascript:alert(1)"\n'),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  expect(problems[0]?.message).toContain("a");
  expect(problems[0]?.message).toContain("javascript:alert(1)");
});

// 線の上書きをノードに指定した（異常系）
test("test_collect_map_problems_when_wire_override_on_node", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    range(
      FLOW,
      '{"version": 1, "layout": {"mount": {"via": [{"x": 0, "y": 0}]}}}',
    ),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  expect(problems[0]?.message).toContain("layout.mount.via");
});

// 設定に無いクラス（異常系）
test("test_collect_map_problems_when_unknown_class", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    range("flowchart LR\n  A:::queue --> B\n"),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_unknown_class",
  ]);
  expect(problems[0]?.message).toContain("queue");
});

// 設定に無い線の名前（異常系）
test("test_collect_map_problems_when_unknown_line", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    range(
      "flowchart LR\n  A --> B\n",
      '{"version": 1, "layout": {"A->B": {"line": "fast"}}}',
    ),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_unknown_line"]);
  expect(problems[0]?.message).toContain("fast");
});

// mermaid のブロックが無い（異常系）
test("test_collect_map_problems_when_no_mermaid", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    { args: "", mermaid: undefined, mermaidCount: 0, data: DATA, dataCount: 1 },
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_invalid"]);
});

// 描けない種類（異常系）
test("test_collect_map_problems_when_unsupported_kind", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(range('pie\n  "a": 1\n'), CONFIG, {
    includeUnknownKeys: true,
    idLinks: SKIP,
  });
  // 検証
  expect(problems).toHaveLength(1);
  expect(problems[0]?.kind).toBe("map_invalid");
  const message = problems[0]?.message ?? "";
  for (const kind of [
    "flowchart",
    "sequenceDiagram",
    "erDiagram",
    "stateDiagram-v2",
    "classDiagram",
    "architecture-beta",
    "C4Context",
    "C4Container",
    "C4Component",
    "C4Dynamic",
    "C4Deployment",
    "mindmap",
  ])
    expect(message).toContain(kind);
});

// 知らない印の引数（異常系）
test("test_collect_map_problems_when_unknown_arg", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const withArg = range("flowchart LR\n  A --> B\n", undefined, '{"mdoe": 1}');
  // 実行
  const checked = collectMapProblems(withArg, CONFIG, {
    includeUnknownKeys: true,
    idLinks: SKIP,
  });
  const drawn = collectMapProblems(withArg, CONFIG, {
    includeUnknownKeys: false,
    idLinks: SKIP,
  });
  // 検証
  expect(checked.map((problem) => problem.kind)).toEqual(["map_unknown_key"]);
  expect(checked[0]?.message).toContain("collapse");
  expect(drawn).toEqual([]);
});

// 知っているアイコン（正常系）
test("test_check_map_config", async () => {
  // 準備
  const { checkMapConfig } = await loadCheck();
  // 実行
  const issues = checkMapConfig({ kinds: { store: { icon: "database" } } });
  // 検証
  expect(issues).toEqual([]);
});

// 無いアイコン（異常系）
test("test_check_map_config_when_unknown_icon", async () => {
  // 準備
  const { checkMapConfig } = await loadCheck();
  // 実行
  const issues = checkMapConfig({ kinds: { store: { icon: "no-such-icon" } } });
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.key).toBe("map.kinds.store.icon");
  expect(issues[0]?.message).toContain("no-such-icon");
});

// ER 図の補足のずれ（異常系）
test("test_collect_map_problems_when_er", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const mermaid =
    'erDiagram\n  注文 {\n    int id PK\n  }\n  明細 {\n    int id PK\n    int 注文ID FK\n  }\n  注文 ||--|{ 明細 : "含む"\n  明細 }o--|| 注文 : "戻る"\n';
  const data = JSON.stringify({
    version: 1,
    notes: {
      "注文.幽霊": { text: "a" },
      r3: { text: "b" },
      記録: { text: "分類の説明" },
    },
    groups: {
      記録: { title: "記録", tables: ["注文", "支払い"] },
      明細: { title: "明細の分類", tables: ["明細"] },
    },
  });
  // 実行
  const problems = collectMapProblems(range(mermaid, data), CONFIG, {
    includeUnknownKeys: true,
    idLinks: SKIP,
  });
  // 検証
  expect(
    problems.filter((item) => item.kind === "map_unknown_ref"),
  ).toHaveLength(3);
  expect(
    problems.filter((item) => item.kind === "map_invalid_value"),
  ).toHaveLength(1);
  // 分類の ID の説明はずれにしない
  expect(problems.some((item) => item.message.includes("notes.記録"))).toBe(
    false,
  );
});

// 状態遷移図の補足のずれ（異常系）
test("test_collect_map_problems_when_state", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const data = JSON.stringify({ version: 1, notes: { t2: { text: "a" } } });
  // 実行
  const problems = collectMapProblems(
    range("stateDiagram-v2\n  [*] --> 下書き\n", data),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems).toHaveLength(1);
  expect(problems[0]?.kind).toBe("map_unknown_ref");
  expect(problems[0]?.message).toContain("notes.t2");
});

// クラス図・アーキテクチャ図・C4 図の補足のずれ（異常系）
test("test_collect_map_problems_when_class_architecture_c4", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const { CLASS, ARCH, C4 } = await import("../../helpers/map.ts");
  const data = (value: object) => JSON.stringify({ version: 1, ...value });
  // 実行
  const problems = [
    ...collectMapProblems(
      range(CLASS, data({ notes: { "図面.幽霊": { text: "a" } } })),
      CONFIG,
      { includeUnknownKeys: true, idLinks: SKIP },
    ),
    ...collectMapProblems(
      range(ARCH, data({ notes: { r9: { text: "a" } } })),
      CONFIG,
      { includeUnknownKeys: true, idLinks: SKIP },
    ),
    ...collectMapProblems(
      range(C4, data({ layout: { ghost: { color: "blue" } } })),
      CONFIG,
      { includeUnknownKeys: true, idLinks: SKIP },
    ),
  ];
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_unknown_ref",
    "map_unknown_ref",
    "map_unknown_ref",
  ]);
  const messages = problems.map((problem) => problem.message).join("\n");
  expect(messages).toContain("notes.図面.幽霊");
  expect(messages).toContain("notes.r9");
  expect(messages).toContain("layout.ghost");
});

// マインドマップの補足とマーカーの引数のずれ（異常系）
test("test_collect_map_problems_when_mindmap", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const { MINDMAP } = await import("../../helpers/map.ts");
  const data = JSON.stringify({
    version: 1,
    notes: { 課題: { text: "a" }, 幽霊: { text: "b" } },
    layout: {
      マイルストーン: { pos: { x: 40, y: 40 } },
      a1: { color: "purple" },
    },
  });
  // 実行
  const problems = collectMapProblems(
    range(MINDMAP, data, '{"focus": "課題"}'),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  const of = (kind: string) =>
    problems.filter((problem) => problem.kind === kind);
  expect(of("map_ambiguous_ref")).toHaveLength(2);
  expect(
    of("map_ambiguous_ref")
      .map((problem) => problem.message)
      .join("\n"),
  ).toContain("notes.課題");
  expect(
    of("map_ambiguous_ref")
      .map((problem) => problem.message)
      .join("\n"),
  ).toContain("focus");
  for (const problem of of("map_ambiguous_ref"))
    expect(problem.message).toContain("ID");
  expect(of("map_unknown_ref")).toHaveLength(1);
  expect(of("map_unknown_ref")[0]?.message).toContain("notes.幽霊");
  expect(of("map_invalid_value")).toHaveLength(1);
  expect(of("map_invalid_value")[0]?.message).toContain(
    "layout.マイルストーン.pos",
  );
  expect(
    problems.some((problem) => problem.message.includes("layout.a1")),
  ).toBe(false);
});

// マインドマップの 2 つ目の根（異常系）
test("test_collect_map_problems_when_mindmap_second_root", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const { MINDMAP_UNREADABLE } = await import("../../helpers/map.ts");
  // 実行
  const problems = collectMapProblems(
    { ...range(MINDMAP_UNREADABLE), mermaidLine: 3 },
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_invalid"]);
  expect(problems[0]?.line).toBeGreaterThan(3);
});

// 軸と格子の配置の図の補足のずれ（異常系）
test("test_collect_map_problems_when_axis_grid", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const gitGraph = 'gitGraph\n  commit msg: "同じ"\n  commit msg: "同じ"\n';
  const data = (body: object) => JSON.stringify({ version: 1, ...body });
  // 実行
  const problems = [
    ...collectMapProblems(
      range(
        GANTT,
        data({
          notes: { 幽霊: { text: "無い" } },
          layout: {
            準備: { collapsed: true },
            tst: { pos: { x: 1, y: 2 } },
          },
        }),
      ),
      CONFIG,
      { includeUnknownKeys: true, idLinks: SKIP },
    ),
    ...collectMapProblems(
      range(gitGraph, data({ notes: { 同じ: { text: "どちらか" } } })),
      CONFIG,
      { includeUnknownKeys: true, idLinks: SKIP },
    ),
    ...collectMapProblems(
      range(BLOCK, data({ layout: { ghost: { color: "green" } } })),
      CONFIG,
      { includeUnknownKeys: true, idLinks: SKIP },
    ),
    ...collectMapProblems(range(TIMELINE, TIMELINE_DATA), CONFIG, {
      includeUnknownKeys: true,
      idLinks: SKIP,
    }),
  ];
  // 検証
  const of = (kind: string) =>
    problems.filter((problem) => problem.kind === kind);
  const unknown = of("map_unknown_ref");
  expect(unknown).toHaveLength(2);
  expect(unknown[0]?.message).toContain("notes.幽霊");
  expect(unknown[1]?.message).toContain("layout.ghost");
  const ambiguous = of("map_ambiguous_ref");
  expect(ambiguous).toHaveLength(2);
  expect(ambiguous[0]?.message).toContain("layout.準備");
  expect(ambiguous[0]?.message).toContain("section");
  expect(ambiguous[1]?.message).toContain("id:");
  const invalid = of("map_invalid_value");
  expect(invalid).toHaveLength(1);
  expect(invalid[0]?.message).toContain("layout.tst.pos");
  expect(problems).toHaveLength(5);
});

// id: のノードのリンク先（正常系）
test("test_collect_map_problems_when_id_link", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const source =
    'flowchart LR\n  A --> B\n  B --> C\n  click A "id:SC-1"\n  click C "javascript:alert(1)"\n';
  // 実行
  const skipped = collectMapProblems(range(source), CONFIG, {
    includeUnknownKeys: true,
    idLinks: SKIP,
  });
  const resolved = collectMapProblems(range(source), CONFIG, {
    includeUnknownKeys: true,
    idLinks: { mode: "resolve", resolveIdLink: undefined },
  });
  // 検証
  expect(skipped.map((problem) => problem.kind)).toEqual(["map_invalid_value"]);
  expect(skipped[0]?.message).toContain("C");
  expect(resolved.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
    "map_invalid_value",
  ]);
  expect(resolved.map((problem) => problem.message).join("\n")).toContain(
    "A: id:SC-1",
  );
});

test("test_collect_map_problems_when_class_id_link", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const source =
    'classDiagram\n  class A\n  class C\n  click A href "id:SC-1"\n  link C "javascript:alert(1)"\n';
  // 実行
  const skipped = collectMapProblems(range(source), CONFIG, {
    includeUnknownKeys: true,
    idLinks: SKIP,
  });
  const resolved = collectMapProblems(range(source), CONFIG, {
    includeUnknownKeys: true,
    idLinks: { mode: "resolve", resolveIdLink: undefined },
  });
  // 検証
  expect(skipped.map((problem) => problem.kind)).toEqual(["map_invalid_value"]);
  expect(skipped[0]?.message).toContain("C");
  expect(resolved.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
    "map_invalid_value",
  ]);
  expect(resolved.map((problem) => problem.message).join("\n")).toContain(
    "A: id:SC-1",
  );
});

// 計画した変更のずれ（異常系）
test("test_collect_map_problems_when_changes", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const er =
    'erDiagram\n  注文 {\n    int id PK\n  }\n  明細 {\n    int id PK\n  }\n  注文 ||--|{ 明細 : "含む"\n';
  // 実行
  const flow = collectMapProblems(
    range(FLOW, '{"version": 1, "changes": {"ghost": {"type": "added"}}}'),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  const table = collectMapProblems(
    range(er, '{"version": 1, "changes": {"注文.id": {"type": "changed"}}}'),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(flow.map((problem) => problem.kind)).toEqual(["map_unknown_ref"]);
  expect(flow[0]?.message).toContain("changes.ghost");
  expect(table.map((problem) => problem.kind)).toEqual(["map_invalid_value"]);
  expect(table[0]?.message).toContain("changes.注文.id");
});

// changes を使用できない図の種類（異常系）
test("test_collect_map_problems_when_changes_unsupported_kind", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(
    range(
      "sequenceDiagram\n  participant a as A\n  participant b as B\n  a->>b: 送る\n",
      '{"version": 1, "changes": {"1": {"type": "added"}}}',
    ),
    CONFIG,
    { includeUnknownKeys: true, idLinks: SKIP },
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  for (const kind of [
    "flowchart",
    "ER 図",
    "状態遷移図",
    "クラス図",
    "アーキテクチャ図",
    "C4 図",
  ])
    expect(problems[0]?.message).toContain(kind);
});

// 読み取れない行だけを返却し、クラスとリンク先は返却しない（異常系）
test("test_collect_plain_map_problems", async () => {
  // 準備
  const { collectPlainMapProblems } = await loadCheck();
  const mermaid = [
    "flowchart LR",
    "  A[受付]:::warn --> B[回答]",
    '  click B "javascript:alert(1)"',
    "  A -> ->",
  ].join("\n");
  // 実行
  const problems = collectPlainMapProblems({
    kind: "flowchart",
    mermaid,
    line: 10,
  });
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_invalid"]);
  expect(problems[0]?.line).toBe(13);
});

// 外観の指定と設定の行は項目にしない（正常系）
test("test_collect_plain_map_problems_when_style", async () => {
  // 準備
  const { collectPlainMapProblems } = await loadCheck();
  const flow = [
    "flowchart LR",
    "  %%{init: {}}%%",
    "  A --> B",
    "  style A fill:#f9f",
    "  classDef warn fill:#ffe08a",
    "  class A warn",
    "  linkStyle 0 stroke:#d33",
  ].join("\n");
  const mindmap = [
    "mindmap",
    "  root((mdmark))",
    "    記法",
    "      ::icon(fa fa-book)",
    "    図:::urgent",
  ].join("\n");
  // 実行
  const results = [
    collectPlainMapProblems({ kind: "flowchart", mermaid: flow, line: 0 }),
    collectPlainMapProblems({ kind: "mindmap", mermaid: mindmap, line: 0 }),
  ];
  // 検証
  expect(results).toEqual([[], []]);
});

/** mermaid の公式の記法の例の見本のフォルダ */
const SAMPLES_DIR = new URL(
  "../../../fixtures/mermaid-syntax/",
  import.meta.url,
);

/** 見本の Markdown から mermaid のコードブロックの中身を取り出す */
const samplesOf = (markdown: string): string[] =>
  [...markdown.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map(
    (match) => match[1] ?? "",
  );

// mermaid の公式の記法の例の見本は記載の警告が 0 件（正常系）
test("test_collect_plain_map_problems_when_mermaid_samples", async () => {
  // 準備
  const { collectPlainMapProblems } = await loadCheck();
  const { plainMapSourceOf } = await import("../../../../src/map/structure.ts");
  const files = readdirSync(SAMPLES_DIR).filter((name) => name.endsWith(".md"));
  // 実行
  const failures = files.flatMap((name) =>
    samplesOf(readFileSync(new URL(name, SAMPLES_DIR), "utf8")).flatMap(
      (source, index) => {
        const plain = plainMapSourceOf(source);
        if (plain === undefined)
          return [`${name}#${index + 1}: map の図にならない`];
        return collectPlainMapProblems({
          kind: plain.kind,
          mermaid: plain.body,
          line: 0,
        }).map((problem) => `${name}#${index + 1}: ${problem.message}`);
      },
    ),
  );
  // 検証
  expect(files).toHaveLength(17);
  expect(failures).toEqual([]);
});
