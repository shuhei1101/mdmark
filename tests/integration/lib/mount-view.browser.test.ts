import { afterEach, expect, inject, test, vi } from "vitest";
import type { MdmarkViewHandle, MountHandle } from "../../../src/index.ts";
import { VIEW_ICON_PATHS } from "../../../src/parts/view.ts";

type Built = typeof import("../../../src/index.ts");

/** 題・状態・担当の列名 */
const COLUMNS = ["題", "状態", "担当"];

/** 状態が上から未着手・進行中・未着手・完了・進行中、担当が佐藤・鈴木・佐藤・田中・鈴木の 5 件。1 件目の題は `script` を含む */
const ITEMS = [
  { 題: "<script>alert(1)</script>設計", 状態: "未着手", 担当: "佐藤" },
  { 題: "余白の変数を決める", 状態: "進行中", 担当: "鈴木" },
  { 題: "印刷の見え方を確かめる", 状態: "未着手", 担当: "佐藤" },
  { 題: "配色を直す", 状態: "完了", 担当: "田中" },
  { 題: "表を絞り込む", 状態: "進行中", 担当: "鈴木" },
];

const elements: HTMLElement[] = [];
const handles: Array<{ destroy: () => void }> = [];
let stylesheetLoaded: Promise<void> | undefined;
let built: Promise<Built> | undefined;

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
function distUrl(file: string): string {
  return `/@fs${inject("builtRoot")}/dist/${file}`;
}

/** 部品のモジュールを 404 にして配る、ビルドした配布物のファイルの URL にする */
function blockedDistUrl(file: string): string {
  return `/fixtures/dist/blocked${inject("builtRoot")}/dist/${file}`;
}

/** ビルドした CSS を 1 度だけ読み込む */
function loadStylesheet(): Promise<void> {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  return stylesheetLoaded;
}

/** ビルドした JS を 1 度だけ読み込み、CSS と合わせて使える状態にする */
async function loadBuilt(): Promise<Built> {
  await loadStylesheet();
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  return built;
}

/** 描く先の要素を作り、ページに置く */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

/** ビューを描き、後始末のために戻り値を控える */
async function mountViewTracked(
  el: HTMLElement,
  opts: Parameters<Built["mountView"]>[1],
): Promise<MdmarkViewHandle> {
  const { mountView } = await loadBuilt();
  const handle = await mountView(el, opts);
  handles.push(handle);
  return handle;
}

/** ボードの列の見出しの値を、並びの順に返す */
function columnNames(el: Element): string[] {
  return [...el.querySelectorAll(".mdmark-view-column-name")].map(
    (name) => name.textContent ?? "",
  );
}

/** ボードの列の見出しの項目の数を、並びの順に返す */
function columnCounts(el: Element): string[] {
  return [...el.querySelectorAll(".mdmark-view-column-count")].map(
    (count) => count.textContent ?? "",
  );
}

/** ボードの列の見出しのアイコンの形を、並びの順に返す */
function columnIcons(el: Element): string[] {
  return [...el.querySelectorAll(".mdmark-view-column-head svg")].map(
    (icon) => icon.innerHTML,
  );
}

/** 切り替えのボタンを返す */
function switchButton(el: Element, mode: "board" | "table"): HTMLButtonElement {
  const button = el.querySelector<HTMLButtonElement>(
    `.mdmark-view-switch button[data-mode="${mode}"]`,
  );
  if (!button) {
    throw new Error(`切り替えのボタンが無い: ${mode}`);
  }
  return button;
}

/** 表形式の本文の行のうち、隠れていない行の数 */
function visibleRows(el: Element): number {
  return [...el.querySelectorAll<HTMLElement>(".mdmark-view-table tbody tr")]
    .filter((row) => !row.classList.contains("mdmark-table-empty"))
    .filter((row) => !row.hidden).length;
}

/** 絞り込みのボタンで担当の列のドロワーを開き、ラベルの文字に合う候補を選ぶ */
function chooseOption(el: Element, text: string): void {
  el.querySelector<HTMLButtonElement>("button.mdmark-filter")?.click();
  const label = [...el.querySelectorAll("label")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  (label?.control as HTMLInputElement | null)?.click();
}

/** `document` に付けた受け取りの数（付けた数から外した数を引いた値）を、種類ごとに数える */
function trackDocumentListeners(): { balance: (type: string) => number } {
  const counts = new Map<string, number>();
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation(
    (type: string, ...rest: unknown[]) => {
      counts.set(type, (counts.get(type) ?? 0) + 1);
      (add as (...args: unknown[]) => void)(type, ...rest);
    },
  );
  vi.spyOn(document, "removeEventListener").mockImplementation(
    (type: string, ...rest: unknown[]) => {
      counts.set(type, (counts.get(type) ?? 0) - 1);
      (remove as (...args: unknown[]) => void)(type, ...rest);
    },
  );
  return { balance: (type) => counts.get(type) ?? 0 };
}

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
  vi.restoreAllMocks();
});

// 列名と項目の値からボード表示を描き、表形式に切り替え、片付ける（正常系）
test("test_normal", async () => {
  // 準備
  const el = createElement();
  // 実行
  const handle = await mountViewTracked(el, {
    columns: COLUMNS,
    items: ITEMS,
    group: "状態",
  });
  // 検証
  expect(el.querySelectorAll(":scope > .mdmark > .mdmark-view")).toHaveLength(
    1,
  );
  expect(columnNames(el)).toEqual(["未着手", "進行中", "完了"]);
  expect(columnCounts(el)).toEqual(["2", "2", "1"]);
  expect(el.textContent).toContain("<script>alert(1)</script>設計");
  expect(el.querySelector("script")).toBeNull();
  // 実行
  const tableButton = switchButton(el, "table");
  tableButton.click();
  // 検証
  expect(visibleRows(el)).toBe(5);
  const heads = [...el.querySelectorAll(".mdmark-view-table thead th")].map(
    (head) => head.textContent ?? "",
  );
  expect(heads).toHaveLength(COLUMNS.length);
  for (const [index, name] of COLUMNS.entries()) {
    expect(heads[index]).toContain(name);
  }
  expect(el.querySelector<HTMLElement>(".mdmark-view-board")?.hidden).toBe(
    true,
  );
  expect(tableButton.getAttribute("aria-pressed")).toBe("true");
  // 実行
  handle.destroy();
  tableButton.click();
  // 検証
  expect(el.childNodes).toHaveLength(0);
});

// filter で指定した列にだけ絞り込みを付け、ボードには当てない（正常系）
test("test_normal_when_filtered", async () => {
  // 準備
  const el = createElement();
  await mountViewTracked(el, {
    columns: COLUMNS,
    items: ITEMS,
    group: "状態",
    default: "table",
    filter: { 担当: "select" },
  });
  // 検証
  const buttons = el.querySelectorAll("thead th button.mdmark-filter");
  expect(buttons).toHaveLength(1);
  expect(buttons[0]?.closest("th")?.cellIndex).toBe(2);
  // 実行
  chooseOption(el, "佐藤");
  // 検証
  expect(visibleRows(el)).toBe(2);
  expect(el.querySelector("button.mdmark-filter")?.className).toContain(
    "is-active",
  );
  // 実行
  switchButton(el, "board").click();
  // 検証
  expect(el.querySelectorAll(".mdmark-view-card")).toHaveLength(5);
  expect(columnCounts(el)).toEqual(["2", "2", "1"]);
  // 実行
  switchButton(el, "table").click();
  // 検証
  expect(visibleRows(el)).toBe(2);
});

// 既定の対応に icons を重ね、列の見出しのアイコンを値ごとに上書きする（正常系）
test("test_normal_when_icons_overridden", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountViewTracked(el, {
    columns: COLUMNS,
    items: [...ITEMS, { 題: "受付の確認", 状態: "受付", 担当: "佐藤" }],
    group: "状態",
    icons: { 未着手: "inbox", 完了: "archive" },
  });
  // 検証
  expect(columnNames(el)).toEqual(["未着手", "進行中", "完了", "受付"]);
  expect(columnIcons(el)).toEqual([
    VIEW_ICON_PATHS.inbox,
    VIEW_ICON_PATHS["circle-dot"],
    VIEW_ICON_PATHS.archive,
    VIEW_ICON_PATHS.circle,
  ]);
  for (const icon of el.querySelectorAll(".mdmark-view-column-head svg")) {
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  }
  const heads = [...el.querySelectorAll(".mdmark-view-column-head")].map(
    (head) => head.textContent,
  );
  expect(heads).toEqual(["未着手2", "進行中2", "完了1", "受付1"]);
});

// 拡張の draw から mountView を呼び、印の場所に描いて、mount の destroy で片付く（正常系）
test("test_normal_when_called_from_extension", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  built.registerExtension({
    name: "tasks",
    directive: "tasks",
    load: async () => ({
      draw: async (slot, value) => {
        const definition = value.definition as {
          columns: string[];
          items: Record<string, string>[];
          group: string;
          filter: Record<string, "select">;
        };
        await built.mountView(slot, definition);
      },
    }),
  });
  const definition = {
    columns: COLUMNS,
    items: ITEMS.slice(0, 3),
    group: "状態",
    filter: { 担当: "select" },
  };
  const markdown = [
    "<!-- tasks -->",
    "",
    "```json",
    JSON.stringify(definition),
    "```",
    "",
    "<!-- /tasks -->",
    "",
  ].join("\n");
  const listeners = trackDocumentListeners();
  // 実行
  const handle: MountHandle = built.mount(el, { markdown });
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-view")).not.toBeNull();
  });
  // 検証
  expect(el.querySelectorAll(".mdmark-view-card")).toHaveLength(3);
  // 実行
  switchButton(el, "table").click();
  chooseOption(el, "鈴木");
  // 検証
  expect(visibleRows(el)).toBe(1);
  // 実行
  handle.destroy();
  // 検証
  expect(el.querySelector(".mdmark-view")).toBeNull();
  expect(listeners.balance("pointerdown")).toBe(0);
  expect(listeners.balance("keydown")).toBe(0);
});

// 項目の値が配列でないときと、group が列名に無いときに、el を書き換えずに TypeError を投げる（異常系）
test("test_error_when_arguments_invalid", async () => {
  // 準備
  const { mountView } = await loadBuilt();
  const el = createElement();
  el.textContent = "前の中身";
  // 実行・検証
  expect(() =>
    mountView(el, { columns: COLUMNS, items: "なし" as never }),
  ).toThrow(TypeError);
  expect(() =>
    mountView(el, { columns: COLUMNS, items: "なし" as never }),
  ).toThrow("items");
  expect(() =>
    mountView(el, { columns: COLUMNS, items: ITEMS, group: "優先度" }),
  ).toThrow(TypeError);
  expect(() =>
    mountView(el, { columns: COLUMNS, items: ITEMS, group: "優先度" }),
  ).toThrow("group");
  expect(el.textContent).toBe("前の中身");
});

// ビューの部品のモジュールを読めないと、el に知らせの枠を置いて reject する（異常系）
test("test_error_when_module_unavailable", async () => {
  // 準備
  await loadStylesheet();
  const blocked: Built = await import(
    /* @vite-ignore */ blockedDistUrl("index.js")
  );
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  // 実行
  const mounting = blocked.mountView(el, {
    columns: COLUMNS,
    items: ITEMS,
    group: "状態",
  });
  // 検証
  await expect(mounting).rejects.toBeDefined();
  const notice = el.querySelector(".mdmark .mdmark-notice");
  expect(notice?.getAttribute("role")).toBe("status");
  expect(notice?.querySelector(".mdmark-notice-title")?.textContent).toBe(
    "この箇所を表示できません",
  );
  expect(el.querySelector(".mdmark-view")).toBeNull();
  expect(spy).toHaveBeenCalled();
});
