import { afterEach, beforeEach, expect, test, vi } from "vitest";

/** コメントの引数とコメントの形の検査を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSpec = () => import("../../../../src/comments/spec.ts");

beforeEach(() => {
  // Node には要素が無いため、`instanceof HTMLElement` で通る代役を置く
  vi.stubGlobal("HTMLElement", class FakeElement {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// 合わない引数ごとに名前を含めて投げる（異常系）
test("test_check_comment_options_when_invalid", async () => {
  // 準備
  const { checkCommentOptions } = await loadSpec();
  const el = new HTMLElement();
  const store = { load: async () => [], save: async () => ({}) };
  const cases: Array<{ el: unknown; opts: unknown; name: string }> = [
    { el: {}, opts: { store, docId: "panel-setup" }, name: "el" },
    {
      el,
      opts: { store: { load: async () => [] }, docId: "panel-setup" },
      name: "opts.store",
    },
    { el, opts: { store, docId: "" }, name: "opts.docId" },
  ];
  // 実行・検証
  for (const { el: target, opts, name } of cases) {
    expect(() => checkCommentOptions(target, opts)).toThrow(TypeError);
    expect(() => checkCommentOptions(target, opts)).toThrow(name);
  }
});

// 形の合う値と合わない値を見分ける（正常系）
test("test_is_comment", async () => {
  // 準備
  const { isComment } = await loadSpec();
  const complete = {
    id: "c1",
    quote: "導入の手順",
    prefix: "",
    suffix: "を整える。",
    body: "手順の数を 3 にする",
  };
  const withoutId = {
    quote: "導入の手順",
    prefix: "",
    suffix: "を整える。",
    body: "手順の数を 3 にする",
  };
  const numberBody = { ...complete, body: 3 };
  // 実行
  const results = [complete, withoutId, numberBody].map((value) =>
    isComment(value),
  );
  // 検証
  expect(results).toEqual([true, false, false]);
});
