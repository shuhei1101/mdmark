import { afterEach, expect, test, vi } from "vitest";
import type { PartStates } from "../../../../src/interact/part-states.ts";
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
      '<!-- table: {"kind": "data"} -->',
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
    attachInteractions({
      root,
      features: { ...features, tabs: false },
      placement: "top",
    }),
  );
  // 検証
  expect(root.querySelector('[role="tablist"]')).toBeNull();
  expect(root.querySelector("thead th button")).not.toBeNull();
});

// 閉じたセクションの中の行へは、セクションを開いてから送信する（正常系）
test("test_attach_interactions_when_row_in_closed_section", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const { root, features } = createRoot(
    [
      "## 親",
      "",
      '<!-- section: {"open": false} -->',
      "",
      '<!-- table: {"kind": "data", "features": {"rowlink": {}}} -->',
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
  // セクションの中身が隠れているかを、行へ送信された時点で記録する
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
  detachers.push(attachInteractions({ root, features, placement: "top" }));
  expect(hiddenWhenScrolled).toEqual([false]);
  expect(row?.hasAttribute("data-target")).toBe(true);
  // 実行・検証: セクションをもう一度閉じ、まとめた HTML の # の構造に変えて hashchange を送信する
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
      placement: "top",
    }),
    attachInteractions({
      root: off.root,
      features: { ...off.features, hints: false },
      placement: "top",
    }),
  );
  const onMark = on.root.querySelector<HTMLElement>(".mdmark-hint-mark");
  const offMark = off.root.querySelector<HTMLElement>(".mdmark-hint-mark");
  if (!onMark || !offMark) {
    throw new Error("ヒントのマーカーが描かれていない");
  }
  const onTip = on.root.querySelector<HTMLElement>('[role="tooltip"]');
  const offTip = off.root.querySelector<HTMLElement>('[role="tooltip"]');
  // 実行・検証: オンではマーカーにフォーカスすると開く
  onMark.focus();
  expect(onTip?.hidden).toBe(false);
  // 実行・検証: オフではマーカーにフォーカスしても閉じたまま
  offMark.focus();
  expect(offTip?.hidden).toBe(true);
});

/** 要素かその中に行を留める方法の属性があるか */
function hasStickyMode(root: HTMLElement): boolean {
  return (
    root.hasAttribute("data-mdmark-sticky") ||
    root.querySelector("[data-mdmark-sticky]") !== null
  );
}

// code がオフならコードブロックにコピーのボタンを付けず、table がオフなら行を留めない（正常系）
test("test_attach_interactions_when_code_off", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const markdown = [
    "```ts",
    "const a = 1;",
    "```",
    "",
    '<!-- table: {"kind": "data", "columns": {"値": {"total": [{"calc": "sum"}]}}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  const on = createRoot(markdown);
  const off = createRoot(markdown);
  // 実行
  detachers.push(
    attachInteractions({
      root: on.root,
      features: on.features,
      placement: "top",
    }),
    attachInteractions({
      root: off.root,
      features: { ...off.features, code: false, table: false },
      placement: "top",
    }),
  );
  // 検証: オンではコピーのボタンを付け、行を留める
  expect(on.root.querySelector(".mdmark-code-copy")).not.toBeNull();
  expect(hasStickyMode(on.root)).toBe(true);
  // 検証: オフではどちらも付けない
  expect(off.root.querySelector(".mdmark-code-copy")).toBeNull();
  expect(hasStickyMode(off.root)).toBe(false);
});

// tree がオフならファイルツリーに開閉とコピーを付けない（正常系）
test("test_attach_interactions_when_tree_off", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const { root, features } = createRoot(
    ["```tree", "app/", "└── src/", "    └── index.ts", "```", ""].join("\n"),
  );
  // 実行
  detachers.push(
    attachInteractions({
      root,
      features: { ...features, tree: false },
      placement: "top",
    }),
  );
  // 検証
  expect(root.querySelector(".mdmark-tree-bar")).toBeNull();
  expect(root.querySelector(".mdmark-tree-toggle")).toBeNull();
});

// lightbox がオフなら画像を包まず、gif がオフならボタンを付けない（正常系）
test("test_attach_interactions_when_lightbox_off", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const { root, features } = createRoot(
    ["![グラフ](chart.png)", "", "![ビルド](build.gif)", ""].join("\n"),
  );
  // 実行
  detachers.push(
    attachInteractions({
      root,
      features: { ...features, lightbox: false, gif: false },
      placement: "top",
    }),
  );
  // 検証
  expect(root.querySelector("img[data-gif]")).not.toBeNull();
  expect(root.querySelector("button.mdmark-image-open")).toBeNull();
  expect(root.querySelector("button.mdmark-gif-toggle")).toBeNull();
});

// 部品の開閉の記録を各部品の操作へ指定する（正常系）
test("test_attach_interactions_when_part_states", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const markdown = [
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "",
    '<!-- row-detail: {"at": 2} -->',
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    "```tree",
    "app/",
    "└── src/",
    "    └── index.ts",
    "```",
    "",
    '<!-- details: {"title": "手順"} -->',
    "",
    "手順の段落",
    "",
    "<!-- /details -->",
    "",
  ].join("\n");
  const partStates: PartStates = new Map();
  const first = createRoot(markdown);
  const detachFirst = attachInteractions({
    root: first.root,
    features: first.features,
    placement: "top",
    partStates,
  });
  first.root
    .querySelector<HTMLButtonElement>("button.mdmark-row-toggle")
    ?.click();
  [
    ...first.root.querySelectorAll<HTMLButtonElement>(
      "button.mdmark-tree-toggle",
    ),
  ]
    .find((button) => button.textContent?.trim().startsWith("src/"))
    ?.click();
  const firstDetails = first.root.querySelector<HTMLDetailsElement>(
    "details.mdmark-collapsible",
  );
  firstDetails?.querySelector("summary")?.click();
  await new Promise((resolve) =>
    firstDetails?.addEventListener("toggle", resolve, { once: true }),
  );
  detachFirst();
  first.root.remove();
  const { root, features } = createRoot(markdown);
  // 実行
  detachers.push(
    attachInteractions({ root, features, placement: "top", partStates }),
  );
  // 検証
  expect(
    root
      .querySelector("button.mdmark-row-toggle")
      ?.getAttribute("aria-expanded"),
  ).toBe("true");
  expect(
    [...root.querySelectorAll("button.mdmark-tree-toggle")]
      .find((button) => button.textContent?.trim().startsWith("src/"))
      ?.getAttribute("aria-expanded"),
  ).toBe("false");
  expect(
    root.querySelector<HTMLDetailsElement>("details.mdmark-collapsible")?.open,
  ).toBe(true);
});
