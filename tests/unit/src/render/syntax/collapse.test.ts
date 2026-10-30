import { expect, test } from "vitest";
import { parseMarkArgs } from "../../../../../src/render/marks.ts";

/** 折り畳みの指定の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCollapse = () =>
  import("../../../../../src/render/syntax/collapse.ts");

// closed と title= を読み、残りの引数を返す（正常系）
test("test_read_collapse", async () => {
  // 準備
  const { readCollapse } = await loadCollapse();
  const args = parseMarkArgs("data closed title=リリースの一覧 filter=名前");
  // 実行
  const spec = readCollapse(args);
  // 検証
  expect(spec.collapse).toBe("closed");
  expect(spec.title).toBe("リリースの一覧");
  expect(spec.items).toEqual([]);
  expect(spec.rest).toEqual({ args: ["data"], keys: { filter: "名前" } });
});

// closed も open も無ければ折り畳まない（正常系）
test("test_read_collapse_when_none", async () => {
  // 準備
  const { readCollapse } = await loadCollapse();
  const args = parseMarkArgs("group=os");
  // 実行
  const spec = readCollapse(args);
  // 検証
  expect(spec.collapse).toBe("none");
  expect(spec.title).toBeUndefined();
  expect(spec.items).toEqual([]);
  expect(spec.rest).toEqual({ args: [], keys: { group: "os" } });
});

// closed と open を両方書いたら closed にして項目を入れる（異常系）
test("test_read_collapse_when_conflict", async () => {
  // 準備
  const { readCollapse } = await loadCollapse();
  const args = parseMarkArgs("closed open title=入れ方");
  // 実行
  const spec = readCollapse(args);
  // 検証
  expect(spec.collapse).toBe("closed");
  expect(spec.title).toBe("入れ方");
  expect(spec.items.map((item) => item.label)).toEqual(["closed と open"]);
});

// closed も open も無い title= は当てずに項目を入れる（異常系）
test("test_read_collapse_when_title_alone", async () => {
  // 準備
  const { readCollapse } = await loadCollapse();
  // 実行
  const alone = readCollapse(parseMarkArgs("title=準備"));
  const empty = readCollapse(parseMarkArgs("open title="));
  // 検証
  expect(alone.collapse).toBe("none");
  expect(alone.title).toBeUndefined();
  expect(alone.items.map((item) => item.label)).toEqual(["title="]);
  expect(alone.items[0]?.message).toContain("closed");
  expect(alone.items[0]?.message).toContain("open");
  expect(empty.collapse).toBe("open");
  expect(empty.title).toBeUndefined();
  expect(empty.items.map((item) => item.label)).toEqual(["title="]);
});
