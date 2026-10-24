import { afterEach, beforeEach, expect, test, vi } from "vitest";

/** ビューの引数の検査を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSpec = () => import("../../../../src/views/spec.ts");

/** 題・状態・担当の列と項目 */
const VALID = {
  columns: ["題", "状態", "担当"],
  items: [{ 題: "配色の変数を洗い出す", 状態: "未着手", 担当: "佐藤" }],
};

beforeEach(() => {
  // Node には要素が無いため、`instanceof HTMLElement` で通る代役を置く
  vi.stubGlobal("HTMLElement", class FakeElement {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// 合う引数では投げない（正常系）
test("test_check_view_options", async () => {
  // 準備
  const { checkViewOptions } = await loadSpec();
  const el = new HTMLElement();
  const opts = {
    ...VALID,
    group: "状態",
    default: "table",
    filter: { 担当: "select" },
    icons: { 完了: "archive" },
  };
  // 実行・検証
  expect(() => checkViewOptions(el, opts)).not.toThrow();
});

// 合わない引数ごとに名前を含めて投げる（異常系）
test("test_check_view_options_when_invalid", async () => {
  // 準備
  const { checkViewOptions } = await loadSpec();
  const el = new HTMLElement();
  const cases: Array<{ opts: unknown; name: string }> = [
    { opts: { ...VALID, columns: [] }, name: "opts.columns" },
    { opts: { ...VALID, columns: ["題", "題"] }, name: "opts.columns" },
    {
      opts: { ...VALID, items: [["配色", "未着手", "佐藤"]] },
      name: "opts.items",
    },
    { opts: { ...VALID, group: "優先度" }, name: "opts.group" },
    { opts: { ...VALID, filter: { 優先度: "select" } }, name: "opts.filter" },
    { opts: { ...VALID, filter: { 担当: "range" } }, name: "opts.filter" },
    { opts: { ...VALID, default: "board" }, name: "opts.default" },
    {
      opts: { ...VALID, group: "状態", icons: { 完了: "rocket" } },
      name: "opts.icons",
    },
  ];
  // 実行・検証
  for (const { opts, name } of cases) {
    expect(() => checkViewOptions(el, opts)).toThrow(TypeError);
    expect(() => checkViewOptions(el, opts)).toThrow(name);
  }
});
