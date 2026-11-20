import { expect, test } from "vitest";
import { CONFIG, FLOW } from "../../helpers/map.ts";

/** 一覧の項目の作成を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadList = () => import("../../../../src/map/list.ts");
const loadFlowchart = () => import("../../../../src/map/flowchart.ts");
const loadSequence = () => import("../../../../src/map/sequence.ts");

// 入れ子と出る線（正常系）
test("test_flow_list_items", async () => {
  // 準備
  const { flowListItems } = await loadList();
  const { parseFlowchart } = await loadFlowchart();
  const chart = parseFlowchart(FLOW);
  // 実行
  const items = flowListItems({
    chart,
    notes: { data: "補足のキーと値を点検する" },
    changes: { mount: "changed" },
    kindLabel: (node) => {
      const kind = chart.nodes.find((item) => item.id === node)?.classes[0];
      return kind === undefined
        ? undefined
        : (CONFIG.kinds as Record<string, { label: string }>)[kind]?.label;
    },
  });
  // 検証
  const lib = items.find((item) => item.id === "lib");
  expect(lib?.children?.map((item) => item.id)).toContain("read");
  const user = items.find((item) => item.id === "user");
  expect(user?.out).toEqual(["→ mount（設定と Markdown）"]);
  const mount = lib?.children?.find((item) => item.id === "mount");
  expect(mount?.change).toBe("changed");
  const read = lib?.children?.find((item) => item.id === "read");
  expect(read?.children?.find((item) => item.id === "data")?.note).toBe(
    "補足のキーと値を点検する",
  );
});

// 記載順のメッセージ（正常系）
test("test_sequence_list_items", async () => {
  // 準備
  const { sequenceListItems } = await loadList();
  const { parseSequence } = await loadSequence();
  const sequence = parseSequence(
    "sequenceDiagram\n  participant a as 画面\n  participant b as API\n  participant c as DB\n  a->>b: OK\n  b->>c: 保存\n  c-->>b: 結果\n  a->>b: OK\n",
  );
  // 実行
  const items = sequenceListItems(sequence);
  // 検証
  expect(items.map((item) => item.id)).toEqual(["1", "2", "3", "4"]);
  expect(items[0]?.name).toBe("画面 → API: OK");
  expect(items[3]?.name).toBe("画面 → API: OK");
  expect(items[0]?.id).not.toBe(items[3]?.id);
});
