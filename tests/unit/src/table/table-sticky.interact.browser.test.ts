import { afterEach, expect, test, vi } from "vitest";
import {
  addStyles,
  createRoot,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 見出し行と集計の行を留める処理を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadSticky = (): Promise<
  typeof import("../../../../src/table/table-sticky.interact.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/table/table-sticky.interact.ts",
      import.meta.url,
    ).href
  );

/** 集計の行を配置する表の操作を読み込む */
const loadTables = () => import("../../../../src/table/table.interact.ts");

const detachers: Array<() => void> = [];

/** 行の数と集計の行を持つ data の表の文書 */
function longTable(rows: number): string {
  return [
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}}} -->',
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

/** 表の囲みか表自身に入れた CSS 変数の値を返却する（入れていなければ空） */
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

/** 留め方の属性を、描く先の要素かその中の要素から探して値を返却する */
function stickyMode(root: HTMLElement): string | null {
  return (
    root.getAttribute("data-mdmark-sticky") ??
    root
      .querySelector("[data-mdmark-sticky]")
      ?.getAttribute("data-mdmark-sticky") ??
    null
  );
}

/** 表を包む横のスクロールの要素の留め方の属性を返却する（包む要素が無ければ null） */
function wrapperMode(root: HTMLElement): string | null {
  return (
    root
      .querySelector(".mdmark-table-scroll")
      ?.getAttribute("data-mdmark-sticky") ?? null
  );
}

/** 表の部品で包まない、行の数だけ本文の行を持つ表の HTML */
function bareTable(rows: number): string {
  const body = Array.from(
    { length: rows },
    (_, i) => `<tr><td>${i + 1}</td><td>${i + 1}</td></tr>`,
  ).join("");
  return `<table><thead><tr><th>番号</th><th>数量</th></tr></thead><tbody>${body}</tbody></table>`;
}

/** 表の見出し行の最初のセルを返却する */
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
  // 検証: 付けた後は表を包む要素が属性を持ち、動く範囲が入る
  expect(wrapperMode(root)).toBe("timeline");
  expect(root.hasAttribute("data-mdmark-sticky")).toBe(false);
  expect(
    Number.parseFloat(stickyVar(root, "--mdmark-sticky-head-max")),
  ).toBeGreaterThan(0);
  expect(
    Number.parseFloat(stickyVar(root, "--mdmark-sticky-foot-max")),
  ).toBeGreaterThan(0);
  // 実行・検証: 削除すると属性と CSS 変数が無くなる
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
  expect(wrapperMode(root)).toBe("script");
  expect(root.hasAttribute("data-mdmark-sticky")).toBe(false);
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

// 削除した後はスクロールしても書き換えない（正常系）
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

// スクロールする区画の中の表は、区画の上端からずれの分だけ下・区画の下端を基準にずらす量を入れる（正常系）
test("test_attach_sticky_rows_when_in_scroller", async () => {
  // 準備: 上端が画面の 100px の位置にある高さ 400px のスクロールする区画の中に表を描く
  addStyles();
  vi.spyOn(CSS, "supports").mockReturnValue(false);
  const { attachStickyRows } = await loadSticky();
  const { attachTables } = await loadTables();
  const { root } = createRoot(longTable(60));
  const scroller = document.createElement("div");
  scroller.style.cssText =
    "position: fixed; top: 100px; left: 0; width: 800px; height: 400px; overflow: auto; --mdmark-sticky-top: 40px";
  document.body.append(scroller);
  scroller.append(root);
  detachers.push(() => scroller.remove());
  detachers.push(attachTables(root));
  const head = headCell(root);
  const headOffset =
    head.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop;
  detachers.push(attachStickyRows(root));
  // 実行: 見出し行の上端が区画の上端より 300px 上になるまで区画をスクロールする
  scroller.scrollTop = headOffset + 300;
  scroller.dispatchEvent(new Event("scroll"));
  await nextFrame();
  // 検証: 見出し行は区画の上端 + 40px、集計の行は区画の下端に留まる
  await vi.waitFor(() => {
    expect(
      Math.abs(head.getBoundingClientRect().top - 140),
    ).toBeLessThanOrEqual(1);
  });
  const foot = root.querySelector<HTMLElement>("tfoot td");
  expect(
    Math.abs((foot?.getBoundingClientRect().bottom ?? 0) - 500),
  ).toBeLessThanOrEqual(1);
});

// 表の部品で包まない表も、table に属性を付けて留める（正常系）
test("test_attach_sticky_rows_when_unwrapped", async () => {
  // 準備
  addStyles();
  vi.spyOn(CSS, "supports").mockReturnValue(false);
  const { attachStickyRows } = await loadSticky();
  const root = createRootFromHtml(bareTable(60));
  const table = root.querySelector<HTMLTableElement>("table");
  if (!table) {
    throw new Error("表が無い");
  }
  const headTop = headCell(root).getBoundingClientRect().top + window.scrollY;
  detachers.push(attachStickyRows(root));
  // 実行: 見出し行の上端が画面の上端より 300px 上になるまでスクロールする
  window.scrollTo(0, headTop + 300);
  await nextFrame();
  // 検証
  expect(table.getAttribute("data-mdmark-sticky")).toBe("script");
  await vi.waitFor(() => {
    expect(table.style.getPropertyValue("--mdmark-sticky-head-shift")).toBe(
      "300px",
    );
  });
});

// px 以外の長さの留める位置も JS でずらす量に換算する（正常系）
test("test_attach_sticky_rows_when_sticky_top_calc", async () => {
  // 準備
  addStyles();
  vi.spyOn(CSS, "supports").mockReturnValue(false);
  const { attachStickyRows } = await loadSticky();
  const root = createRootFromHtml(bareTable(60));
  root.style.setProperty("--mdmark-sticky-top", "calc(.25rem * 24)");
  const headTop = headCell(root).getBoundingClientRect().top + window.scrollY;
  detachers.push(attachStickyRows(root));
  // 実行: 見出し行の上端が画面の上端より 300px 上になるまでスクロールする
  window.scrollTo(0, headTop + 300);
  await nextFrame();
  // 検証
  await vi.waitFor(() => {
    expect(
      Math.abs(headCell(root).getBoundingClientRect().top - 96),
    ).toBeLessThanOrEqual(1);
  });
});

// 横にだけスクロールする要素の中の表は、画面を基準にし、animation-timeline を持つブラウザでも JS でずらす（正常系）
test("test_attach_sticky_rows_when_in_wide_range", async () => {
  // 準備: 横にだけスクロールする要素（縦にははみ出さない）の中に表を描く
  addStyles();
  vi.spyOn(CSS, "supports").mockReturnValue(true);
  const { attachStickyRows } = await loadSticky();
  const { attachTables } = await loadTables();
  const { root } = createRoot(longTable(60));
  const range = document.createElement("div");
  range.style.overflowX = "auto";
  range.append(...root.childNodes);
  root.append(range);
  detachers.push(attachTables(root));
  const head = headCell(root);
  const headTop = head.getBoundingClientRect().top + window.scrollY;
  detachers.push(attachStickyRows(root));
  // 実行: 見出し行の上端が画面の上端より 300px 上になるまでページをスクロールする
  window.scrollTo(0, headTop + 300);
  await nextFrame();
  // 検証
  expect(wrapperMode(root)).toBe("script");
  await vi.waitFor(() => {
    expect(stickyVar(root, "--mdmark-sticky-head-shift")).toBe("300px");
  });
  expect(Math.abs(head.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
});

/** `columns` の機能と集計の行を持ち、本文の行の数だけ行を持つ表の文書 */
function menuTable(rows: number): string {
  return longTable(rows).replace(
    '"kind": "data", ',
    '"kind": "data", "features": {"columns": {}}, ',
  );
}

/** 矩形が画面の中に入っているか */
function inViewport(rect: DOMRect): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= document.documentElement.clientHeight &&
    rect.right <= document.documentElement.clientWidth
  );
}

// 表のメニューのボタンを見出し行と同じだけ下へずらす（正常系）
test.each([false, true])(
  "test_attach_sticky_rows_when_table_menu (CSS.supports: %s)",
  async (supports) => {
    // 準備
    addStyles();
    vi.spyOn(CSS, "supports").mockReturnValue(supports);
    const { attachStickyRows } = await loadSticky();
    const { attachTables } = await loadTables();
    const { root } = createRoot(menuTable(60));
    detachers.push(attachTables(root));
    const head = headCell(root);
    const button = root.querySelector<HTMLButtonElement>(
      "button.mdmark-table-menu",
    );
    if (!button) {
      throw new Error("表のメニューのボタンが無い");
    }
    const offset =
      button.getBoundingClientRect().top - head.getBoundingClientRect().top;
    const headTop = head.getBoundingClientRect().top + window.scrollY;
    detachers.push(attachStickyRows(root));
    // 実行: 見出し行の上端が画面の上端より 300px 上になるまでスクロールする
    window.scrollTo(0, headTop + 300);
    await nextFrame();
    // 検証: ボタンが見出し行と同じだけずれる
    if (!supports) {
      await vi.waitFor(() => {
        expect(stickyVar(root, "--mdmark-sticky-head-shift")).toBe("300px");
      });
    }
    await vi.waitFor(() => {
      const now =
        button.getBoundingClientRect().top - head.getBoundingClientRect().top;
      expect(Math.abs(now - offset)).toBeLessThanOrEqual(1);
    });
    // 実行・検証: 開いた表のメニューがボタンの直下で画面の中にある
    button.click();
    const menu = root.querySelector<HTMLElement>(".mdmark-table-menu-panel");
    const menuRect = menu?.getBoundingClientRect();
    const buttonBottom = button.getBoundingClientRect().bottom;
    expect(menuRect).toBeDefined();
    expect(Math.abs((menuRect?.top ?? 0) - buttonBottom)).toBeLessThanOrEqual(
      4,
    );
    expect(menuRect && inViewport(menuRect)).toBe(true);
    // 実行・検証: テーブル設定のパネルもボタンの直下で画面の中にある
    root
      .querySelector<HTMLButtonElement>(
        'button.mdmark-table-menu-item[data-action="settings"]',
      )
      ?.click();
    const panelRect = root
      .querySelector<HTMLElement>(".mdmark-table-settings")
      ?.getBoundingClientRect();
    expect(panelRect).toBeDefined();
    expect(
      Math.abs((panelRect?.top ?? 0) - button.getBoundingClientRect().bottom),
    ).toBeLessThanOrEqual(4);
    expect(panelRect && inViewport(panelRect)).toBe(true);
  },
);
