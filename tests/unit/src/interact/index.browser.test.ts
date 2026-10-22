import { afterEach, expect, test, vi } from "vitest";
import { wrapHtml } from "../../helpers/charts.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** 操作を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadInteract = () => import("../../../../src/interact/index.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
  history.replaceState(null, "", location.pathname);
});

// オフの記法には操作を付けない（正常系）
test("test_attach_interactions", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const { root, features } = createRoot(
    [
      "<!-- tabs -->",
      "",
      "### A",
      "",
      "a",
      "",
      "### B",
      "",
      "b",
      "",
      "<!-- /tabs -->",
      "",
      "<!-- table: data -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  // 実行
  detachers.push(
    attachInteractions({ root, features: { ...features, tabs: false } }),
  );
  // 検証
  expect(root.querySelector('[role="tablist"]')).toBeNull();
  expect(root.querySelector("thead th button")).not.toBeNull();
});

// 閉じた節の中の行へは、節を開いてから送る（正常系）
test("test_attach_interactions_when_row_in_closed_section", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const { root, features } = createRoot(
    [
      "## 親",
      "",
      "<!-- section: closed -->",
      "",
      "<!-- table: data +rowlink -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| ぶどう | 1 |",
      "| もも | 2 |",
      "| なし | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  const body = root.querySelector<HTMLElement>('[id="section-親"]');
  const row = root.querySelector<HTMLElement>('tr[id="もも"]');
  const toggle = root.querySelector<HTMLButtonElement>(
    '[aria-controls="section-親"]',
  );
  // 節の中身が隠れているかを、行へ送られた時点で記録する
  const hiddenWhenScrolled: boolean[] = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (
    this: Element,
  ) {
    if (this.id === "もも") {
      hiddenWhenScrolled.push(body?.hasAttribute("hidden") ?? true);
    }
  });
  // 実行・検証: #ID のまま付ける
  history.replaceState(null, "", "#もも");
  detachers.push(attachInteractions({ root, features }));
  expect(hiddenWhenScrolled).toEqual([false]);
  expect(row?.hasAttribute("data-target")).toBe(true);
  // 実行・検証: 節を閉じ直し、まとめた HTML の # の形に変えて hashchange を送る
  toggle?.click();
  row?.removeAttribute("data-target");
  hiddenWhenScrolled.length = 0;
  location.hash = "#/a.md#もも";
  await vi.waitFor(() => {
    expect(hiddenWhenScrolled).toEqual([false]);
  });
  expect(row?.hasAttribute("data-target")).toBe(true);
});

// hints がオフなら埋め込んだ HTML にツールチップの操作を付けない（正常系）
test("test_attach_interactions_when_hints_off", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const markdown = wrapHtml('<div data-hint="説明">本文</div>');
  const on = createRoot(markdown);
  const off = createRoot(markdown);
  detachers.push(
    attachInteractions({
      root: on.root,
      features: { ...on.features, hints: true },
    }),
    attachInteractions({
      root: off.root,
      features: { ...off.features, hints: false },
    }),
  );
  const onMark = on.root.querySelector<HTMLElement>(".mdmark-hint-mark");
  const offMark = off.root.querySelector<HTMLElement>(".mdmark-hint-mark");
  if (!onMark || !offMark) {
    throw new Error("ヒントの印が描かれていない");
  }
  const onTip = on.root.querySelector<HTMLElement>('[role="tooltip"]');
  const offTip = off.root.querySelector<HTMLElement>('[role="tooltip"]');
  // 実行・検証: オンでは印にフォーカスすると開く
  onMark.focus();
  expect(onTip?.hidden).toBe(false);
  // 実行・検証: オフでは印にフォーカスしても閉じたまま
  offMark.focus();
  expect(offTip?.hidden).toBe(true);
});
