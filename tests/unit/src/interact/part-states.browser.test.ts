import { afterEach, expect, test } from "vitest";
import type { PartStates } from "../../../../src/interact/part-states.ts";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 部品の開閉の記録を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL で読み込む） */
const loadPartStates = (): Promise<
  typeof import("../../../../src/interact/part-states.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/interact/part-states.ts",
      import.meta.url,
    ).href
  );

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

/** ファイルツリーの部品 1 つの HTML */
const TREE_HTML = '<div class="mdmark-tree"><ul></ul></div>';

/** 中身の `id` を持つセクションの HTML */
function sectionHtml(id: string, body: string): string {
  return `<div class="mdmark-section-body" id="${id}">${body}</div>`;
}

/** `details` の `toggle` を待つ */
function nextToggle(details: HTMLDetailsElement): Promise<unknown> {
  return new Promise((resolve) =>
    details.addEventListener("toggle", resolve, { once: true }),
  );
}

/** `details` の `summary` を押し、`toggle` を待つ */
async function clickSummary(details: HTMLDetailsElement): Promise<void> {
  const toggled = nextToggle(details);
  details.querySelector("summary")?.click();
  await toggled;
}

/** 描いた要素の中の最初の `details` を返却する（無ければ例外） */
function firstDetails(root: HTMLElement): HTMLDetailsElement {
  const details = root.querySelector<HTMLDetailsElement>("details");
  if (!details) {
    throw new Error("details が無い");
  }
  return details;
}

// 囲むセクションとその中の順番で鍵を作る（正常系）
test("test_part_key", async () => {
  // 準備
  const { partKey } = await loadPartStates();
  const root = createRootFromHtml(
    TREE_HTML +
      sectionHtml("section-a", TREE_HTML + TREE_HTML) +
      sectionHtml("section-b", TREE_HTML),
  );
  const trees = [...root.querySelectorAll("div.mdmark-tree")];
  // 実行
  const keys = trees.map((part) =>
    partKey({ root, part, kind: "tree", inner: "app/src" }),
  );
  // 検証
  expect(keys).toEqual([
    "tree||0|app/src",
    "tree|section-a|0|app/src",
    "tree|section-a|1|app/src",
    "tree|section-b|0|app/src",
  ]);
});

// 入れ子のセクションの中の部品は外側のセクションの順番に数えない（正常系）
test("test_part_key_when_nested_section", async () => {
  // 準備
  const { partKey } = await loadPartStates();
  const root = createRootFromHtml(
    sectionHtml(
      "section-a",
      TREE_HTML + sectionHtml("section-a-1", TREE_HTML) + TREE_HTML,
    ),
  );
  const trees = [...root.querySelectorAll("div.mdmark-tree")];
  const third = trees[2];
  if (!third) {
    throw new Error("3 つ目のツリーが無い");
  }
  // 実行
  const key = partKey({ root, part: third, kind: "tree" });
  // 検証
  expect(key).toBe("tree|section-a|1");
});

// マーカーが同じ記録の開閉を返却する（正常系）
test("test_start_open", async () => {
  // 準備
  const { startOpen } = await loadPartStates();
  const states: PartStates = new Map([["k", { open: true, marker: "closed" }]]);
  // 実行
  const open = startOpen({
    states,
    key: "k",
    marker: "closed",
    markerOpen: false,
  });
  // 検証
  expect(open).toBe(true);
});

// マーカーが変わった要素と記録の無い要素はマーカーのとおり（正常系）
test("test_start_open_when_marker_changed", async () => {
  // 準備
  const { startOpen } = await loadPartStates();
  const states: PartStates = new Map([
    ["k", { open: false, marker: "closed" }],
  ]);
  // 実行
  const changed = startOpen({
    states,
    key: "k",
    marker: "open",
    markerOpen: true,
  });
  const missing = startOpen({
    states,
    key: "j",
    marker: "",
    markerOpen: false,
  });
  // 検証
  expect(changed).toBe(true);
  expect(missing).toBe(false);
});

// 最後の開閉を書き込む（正常系）
test("test_record_open", async () => {
  // 準備
  const { recordOpen } = await loadPartStates();
  const states: PartStates = new Map();
  // 実行
  recordOpen({ states, key: "k", open: true, marker: "closed" });
  recordOpen({ states, key: "k", open: false, marker: "closed" });
  // 検証
  expect(states.get("k")).toEqual({ open: false, marker: "closed" });
});

/** 閉じた details の範囲と、開いた折りたたみの注意書きを並べた HTML */
const DETAILS_HTML =
  '<details class="mdmark-collapsible"><summary>手順</summary><p>手順の段落</p></details>' +
  '<details class="markdown-alert markdown-alert-note" open><summary class="markdown-alert-title">詳細</summary><p>詳細の段落</p></details>';

// 押した開閉を記録し、もう一度付けると記録の開閉で始める（正常系）
test("test_attach_details_states", async () => {
  // 準備
  const { attachDetailsStates } = await loadPartStates();
  const states: PartStates = new Map();
  const first = createRootFromHtml(DETAILS_HTML);
  const detachFirst = attachDetailsStates({ root: first, states });
  for (const details of first.querySelectorAll<HTMLDetailsElement>("details")) {
    await clickSummary(details);
  }
  detachFirst();
  first.remove();
  const root = createRootFromHtml(DETAILS_HTML);
  // 実行
  detachers.push(attachDetailsStates({ root, states }));
  // 検証
  const [collapsible, callout] =
    root.querySelectorAll<HTMLDetailsElement>("details");
  expect(collapsible?.open).toBe(true);
  expect(callout?.open).toBe(false);
});

// summary を押さずに変わった開閉は記録しない（正常系）
test("test_attach_details_states_when_not_clicked", async () => {
  // 準備
  const { attachDetailsStates } = await loadPartStates();
  const states: PartStates = new Map();
  const root = createRootFromHtml(
    '<details class="mdmark-collapsible"><summary>手順</summary><p>手順の段落</p></details>',
  );
  detachers.push(attachDetailsStates({ root, states }));
  const details = firstDetails(root);
  // 実行
  const toggled = nextToggle(details);
  details.open = true;
  await toggled;
  // 検証
  expect(states.size).toBe(0);
});

// open 属性が記録したときと変わった details はマーカーのとおり（正常系）
test("test_attach_details_states_when_marker_changed", async () => {
  // 準備
  const { attachDetailsStates } = await loadPartStates();
  const states: PartStates = new Map();
  const first = createRootFromHtml(
    '<details class="mdmark-collapsible"><summary>注意</summary><p>注意の段落</p></details>',
  );
  const detachFirst = attachDetailsStates({ root: first, states });
  await clickSummary(firstDetails(first));
  await clickSummary(firstDetails(first));
  detachFirst();
  first.remove();
  const root = createRootFromHtml(
    '<details class="mdmark-collapsible" open><summary>注意</summary><p>注意の段落</p></details>',
  );
  // 実行
  detachers.push(attachDetailsStates({ root, states }));
  // 検証
  expect(firstDetails(root).open).toBe(true);
});

// 前付けの折りたたみは記録しない（正常系）
test("test_attach_details_states_when_frontmatter", async () => {
  // 準備
  const { attachDetailsStates } = await loadPartStates();
  const states: PartStates = new Map();
  const root = createRootFromHtml(
    '<details class="mdmark-collapsible mdmark-frontmatter"><summary>前付け</summary><p>値</p></details>',
  );
  detachers.push(attachDetailsStates({ root, states }));
  // 実行
  await clickSummary(firstDetails(root));
  // 検証
  expect(states.size).toBe(0);
});
