import { afterEach, expect, test, vi } from "vitest";
import type { PartStates } from "../../../../src/interact/part-states.ts";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 操作を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadInteract = () => import("../../../../src/interact/index.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
  restoreClipboard();
});

/** 階層の表の行（キーは `features.table`・`features.html`・`aliases[].id`・`aliases[].metadata.alias_type.type`） */
const TREE_ROWS = [
  "| キー | 説明 |",
  "| --- | --- |",
  "| features.table | 表の機能 |",
  "| features.html | 埋め込んだ HTML の機能 |",
  "| aliases[].id | 別名の ID |",
  "| aliases[].metadata.alias_type.type | 別名の種類 |",
];

/** 表のマーカーで囲んだ階層の表の Markdown */
function treeTable(mark: Record<string, unknown>): string {
  return [
    `<!-- table: ${JSON.stringify(mark)} -->`,
    "",
    ...TREE_ROWS,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 見本を結んだ階層の表と、見出し `設定の見本` の下の 2 つのタブを持つ文書 */
const EXAMPLE_DOC = [
  treeTable({
    kind: "data",
    tree: { key: { column: "キー" }, example: { heading: "設定の見本" } },
  }),
  "## 設定の見本",
  "",
  "<!-- tabs -->",
  "",
  "### 最小",
  "",
  "```yaml",
  "features:",
  "  table: true",
  "  html: true",
  "```",
  "",
  "### エイリアス",
  "",
  "```yaml",
  "aliases:",
  "  - id: terms",
  "```",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

/** 文書を描いて操作を付け、描いた要素を返却する */
async function attach(markdown: string): Promise<HTMLElement> {
  addStyles();
  const { attachInteractions } = await loadInteract();
  const { root, features } = createRoot(markdown);
  detachers.push(attachInteractions({ root, features, placement: "top" }));
  return root;
}

/** パスの階層の行を返却する（無ければ例外） */
function rowOf(root: HTMLElement, path: string): HTMLTableRowElement {
  const row = [
    ...root.querySelectorAll<HTMLTableRowElement>("tr.mdmark-tree-row"),
  ].find((candidate) => candidate.dataset.path === path);
  if (!row) {
    throw new Error(`行が無い: ${path}`);
  }
  return row;
}

/** 表示している階層の行のパスを、並んだ順に返却する */
function shownPaths(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLTableRowElement>("tr.mdmark-tree-row")]
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.path ?? "");
}

// 開閉のボタンで子孫を畳み、Shift で入れ子もまとめて開閉する（正常系）
test("test_attach_table_tree_when_folded", async () => {
  // 準備
  const root = await attach(
    treeTable({ kind: "data", tree: { key: { column: "キー" } } }),
  );
  const toggle = rowOf(root, "aliases[]").querySelector<HTMLButtonElement>(
    "button.mdmark-tree-toggle",
  );
  if (!toggle) {
    throw new Error("開閉のボタンが無い");
  }
  // 実行・検証: 畳む
  toggle.click();
  for (const path of [
    "aliases[].id",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
    "aliases[].metadata.alias_type.type",
  ]) {
    expect(rowOf(root, path).hidden).toBe(true);
  }
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  // 実行・検証: Shift を押しながら開く
  toggle.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    }),
  );
  expect(shownPaths(root)).toHaveLength(8);
  for (const button of root.querySelectorAll("button.mdmark-tree-toggle")) {
    expect(button.getAttribute("aria-expanded")).toBe("true");
  }
});

// 行を選ぶと同じ親の範囲の縦線を濃くし、見本の同じパスの行に色を付ける（正常系）
test("test_attach_table_tree_when_selected", async () => {
  // 準備
  const root = await attach(EXAMPLE_DOC);
  const row = rowOf(root, "features.table");
  // 実行
  row.cells[1]?.click();
  // 検証
  expect(row.getAttribute("aria-selected")).toBe("true");
  for (const path of ["features.table", "features.html"]) {
    const guide = rowOf(root, path).querySelector(".mdmark-tree-guide");
    expect(guide?.classList.contains("is-active")).toBe(true);
  }
  const linked = root.querySelector<HTMLElement>(
    '.mdmark-tree-example [role="tabpanel"]:not([hidden]) .mdmark-yaml-line[data-path="features.table"]',
  );
  expect(linked?.classList.contains("is-linked")).toBe(true);
});

// 末尾の名前で絞り込み、祖先を残して件数を書き換える（正常系）
test("test_attach_table_tree_when_filtered", async () => {
  // 準備
  const root = await attach(
    treeTable({
      kind: "data",
      features: { count: {} },
      columns: { キー: { filter: { type: "text" } } },
      tree: { key: { column: "キー" } },
    }),
  );
  root.querySelector<HTMLButtonElement>("button.mdmark-filter")?.click();
  const input = root.querySelector<HTMLInputElement>(
    ".mdmark-filter-drawer input",
  );
  if (!input) {
    throw new Error("絞り込みの欄が無い");
  }
  // 実行
  input.value = "id";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  // 検証
  expect(shownPaths(root)).toEqual(["aliases[]", "aliases[].id"]);
  expect(root.querySelectorAll("mark.mdmark-tree-hit")).toHaveLength(1);
  expect(root.querySelector(".mdmark-table-count")?.textContent).toContain(
    "1 / 4 件",
  );
});

// コピーのボタンで全体のパスを記載し、行の選択を変えない（正常系）
test("test_attach_table_tree_when_copied", async () => {
  // 準備
  const writeText = vi.fn(async () => {});
  stubClipboard(writeText);
  const root = await attach(
    treeTable({ kind: "data", tree: { key: { column: "キー" } } }),
  );
  const copy = rowOf(root, "aliases[].id").querySelector<HTMLButtonElement>(
    "button.mdmark-tree-copy",
  );
  // 実行
  copy?.click();
  // 検証
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  expect(writeText).toHaveBeenCalledWith("aliases[].id");
  expect(root.querySelector('tr[aria-selected="true"]')).toBeNull();
});

// 見本の表示を切り替える（正常系）
test("test_attach_table_tree_when_example_hidden", async () => {
  // 準備
  const root = await attach(EXAMPLE_DOC);
  const toggle = root.querySelector<HTMLButtonElement>(
    "button.mdmark-tree-example-toggle",
  );
  if (!toggle) {
    throw new Error("見本の表示を切り替えるボタンが無い");
  }
  expect(toggle.textContent?.trim()).toBe("見本を隠す");
  // 実行
  toggle.click();
  // 検証
  expect(
    root
      .querySelector(".mdmark-tree-layout")
      ?.classList.contains("is-example-hidden"),
  ).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.textContent?.trim()).toBe("見本を表示");
});

// 記録した開閉で始め、押した開閉を記録する（正常系）
test("test_attach_table_tree_when_states", async () => {
  // 準備
  addStyles();
  const { attachInteractions } = await loadInteract();
  const markdown = treeTable({
    kind: "data",
    tree: { key: { column: "キー" } },
  });
  const partStates: PartStates = new Map();
  const first = createRoot(markdown);
  const detachFirst = attachInteractions({
    root: first.root,
    features: first.features,
    placement: "top",
    partStates,
  });
  rowOf(first.root, "aliases[]")
    .querySelector<HTMLButtonElement>("button.mdmark-tree-toggle")
    ?.click();
  detachFirst();
  first.root.remove();
  const { root, features } = createRoot(markdown);
  // 実行
  detachers.push(
    attachInteractions({ root, features, placement: "top", partStates }),
  );
  // 検証: aliases[] の子孫は畳んだまま始まる
  expect(rowOf(root, "aliases[].id").hidden).toBe(true);
  expect(
    rowOf(root, "aliases[]")
      .querySelector("button.mdmark-tree-toggle")
      ?.getAttribute("aria-expanded"),
  ).toBe("false");
});
