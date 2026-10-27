import { afterEach, expect, test, vi } from "vitest";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 見出し行と集計の行を留める処理を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む） */
const loadSticky = (): Promise<
  typeof import("../../../../src/interact/sticky.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/interact/sticky.ts",
      import.meta.url,
    ).href
  );

/** 集計の行を置く表の操作を読み込む */
const loadTables = () => import("../../../../src/interact/tables.ts");

const detachers: Array<() => void> = [];

/** 行の数と集計の行を持つ data の表の文書 */
function longTable(rows: number): string {
  return [
    "<!-- table: data +total total=数量:sum -->",
    "",
    "| 番号 | 数量 |",
    "| --- | --- |",
    ...Array.from({ length: rows }, (_, i) => `| ${i + 1} | ${i + 1} |`),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 次の描画の更新を待つ */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** 表の囲みか表自身に入れた CSS 変数の値を返す（入れていなければ空） */
function stickyVar(root: HTMLElement, name: string): string {
  const elements = root.querySelectorAll<HTMLElement>(
    ".mdmark-table, .mdmark-table table",
  );
  for (const element of elements) {
    const value = element.style.getPropertyValue(name);
    if (value) {
      return value;
    }
  }
  return "";
}

/** 留め方の属性を、描く先の要素かその中の要素から探して値を返す */
function stickyMode(root: HTMLElement): string | null {
  return (
    root.getAttribute("data-mdmark-sticky") ??
    root
      .querySelector("[data-mdmark-sticky]")
      ?.getAttribute("data-mdmark-sticky") ??
    null
  );
}

/** 表の見出し行の最初のセルを返す */
function headCell(root: HTMLElement): HTMLElement {
  const cell = root.querySelector<HTMLElement>("thead th");
  if (!cell) {
    throw new Error("見出し行が無い");
  }
  return cell;
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
  window.scrollTo(0, 0);
});

// animation-timeline を持つブラウザでは動く範囲を CSS 変数に入れる（正常系）
test("test_attach_sticky_rows_when_timeline", async () => {
  // 準備
  addStyles();
  vi.spyOn(CSS, "supports").mockReturnValue(true);
  const { attachStickyRows } = await loadSticky();
  const { attachTables } = await loadTables();
  const { root } = createRoot(longTable(30));
  detachers.push(attachTables(root));
  // 実行
  const detach = attachStickyRows(root);
  // 検証: 付けた後は動く範囲が入る
  expect(stickyMode(root)).toBe("timeline");
  expect(
    Number.parseFloat(stickyVar(root, "--mdmark-sticky-head-max")),
  ).toBeGreaterThan(0);
  expect(
    Number.parseFloat(stickyVar(root, "--mdmark-sticky-foot-max")),
  ).toBeGreaterThan(0);
  // 実行・検証: 外すと属性と CSS 変数が無くなる
  detach();
  expect(stickyMode(root)).toBeNull();
  expect(stickyVar(root, "--mdmark-sticky-head-max")).toBe("");
  expect(stickyVar(root, "--mdmark-sticky-foot-max")).toBe("");
});

// animation-timeline を持たないブラウザではスクロールに合わせてずらす量を入れる（正常系）
test("test_attach_sticky_rows_when_script", async () => {
  // 準備
  addStyles();
  vi.spyOn(CSS, "supports").mockReturnValue(false);
  const { attachStickyRows } = await loadSticky();
  const { attachTables } = await loadTables();
  const { root } = createRoot(longTable(60));
  detachers.push(attachTables(root));
  const head = headCell(root);
  const headTop = head.getBoundingClientRect().top + window.scrollY;
  detachers.push(attachStickyRows(root));
  // 実行: 見出し行の上端が画面の上端より 300px 上になるまでスクロールする
  window.scrollTo(0, headTop + 300);
  await nextFrame();
  // 検証
  expect(stickyMode(root)).toBe("script");
  await vi.waitFor(() => {
    expect(stickyVar(root, "--mdmark-sticky-head-shift")).toBe("300px");
  });
  expect(stickyVar(root, "--mdmark-sticky-foot-reach")).toBe("2px");
  expect(Math.round(head.getBoundingClientRect().top)).toBe(0);
  const foot = root.querySelector<HTMLElement>("tfoot td");
  expect(Math.round(foot?.getBoundingClientRect().bottom ?? 0)).toBe(
    document.documentElement.clientHeight,
  );
});

// 外した後はスクロールしても書き換えない（正常系）
test("test_attach_sticky_rows_when_detached", async () => {
  // 準備
  addStyles();
  vi.spyOn(CSS, "supports").mockReturnValue(false);
  const { attachStickyRows } = await loadSticky();
  const { attachTables } = await loadTables();
  const { root } = createRoot(longTable(60));
  detachers.push(attachTables(root));
  const headTop = headCell(root).getBoundingClientRect().top + window.scrollY;
  const detach = attachStickyRows(root);
  detach();
  // 実行
  window.scrollTo(0, headTop + 300);
  await nextFrame();
  await nextFrame();
  // 検証
  expect(stickyMode(root)).toBeNull();
  expect(stickyVar(root, "--mdmark-sticky-head-shift")).toBe("");
});
