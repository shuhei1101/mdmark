import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { addStyles } from "../../helpers/dom.ts";
import { loadSource } from "../../helpers/lazy.ts";

/** ビューのカスタム要素を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadElement = () =>
  loadSource(
    import.meta.glob<
      typeof import("../../../../src/views/mdmark-view.element.ts")
    >("../../../../src/views/mdmark-view.element.ts"),
  );

/** 部品のモジュールを読み込む処理を読み込む */
const loadPartModules = () => import("../../../../src/part-modules.ts");

/** ビューの部品のモジュールを読み込む */
const loadViews = () => import("../../../../src/views/index.ts");

const elements: HTMLElement[] = [];

beforeAll(async () => {
  addStyles();
  const { defineViewElement } = await loadElement().catch(() => ({
    defineViewElement: undefined,
  }));
  defineViewElement?.(customElements);
});

beforeEach(async () => {
  const { partModules, partModuleLoaders, setPartModuleLoader } =
    await loadPartModules();
  partModules.clear();
  partModuleLoaders.clear();
  setPartModuleLoader("view", loadViews);
});

afterEach(() => {
  for (const element of elements.splice(0)) {
    element.remove();
  }
});

/** タイトル・状態・担当の列名 */
const columns = () => ["タイトル", "状態", "担当"];

/** 状態が未着手・進行中・完了の 3 件 */
const items = () => [
  { key: "T1", values: { タイトル: "設計", 状態: "未着手", 担当: "佐藤" } },
  { key: "T2", values: { タイトル: "実装", 状態: "進行中", 担当: "鈴木" } },
  { key: "T3", values: { タイトル: "確認", 状態: "完了", 担当: "田中" } },
];

/** 型 MdmarkViewElement のプロパティを持つ要素 */
type ViewElement = HTMLElement & {
  columns?: unknown;
  items?: unknown;
  group?: unknown;
  default?: unknown;
  filter?: unknown;
  icons?: unknown;
};

/** ページに配置した <mdmark-view> */
function createView(parent: HTMLElement = document.body): ViewElement {
  const element = document.createElement("mdmark-view") as ViewElement;
  parent.append(element);
  elements.push(element);
  return element;
}

/** 描き終えるまで待つ（部品のモジュールの読み込みを含む） */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

/** ビューの部品の代役のモジュール。`drawView` を呼ばれた回数と片付けを記録する */
function recordingModule() {
  const record = { draws: 0, detaches: 0 };
  const module = {
    drawView: (el: HTMLElement) => {
      record.draws += 1;
      el.replaceChildren(document.createElement("div"));
      return () => {
        record.detaches += 1;
      };
    },
    attachView: () => () => {},
  };
  return { record, module };
}

/** 表形式の本文の行のうち、隠れていない行のキー */
function shownKeys(element: HTMLElement): string[] {
  return [
    ...element.querySelectorAll<HTMLTableRowElement>(
      ".mdmark-view-table tbody tr",
    ),
  ]
    .filter((row) => !row.classList.contains("mdmark-table-empty"))
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.key ?? "");
}

// 登録する前に代入したプロパティで描く（正常系）
test("test_connected_callback_when_upgraded", async () => {
  // 準備
  const { MdmarkViewElement } = await loadElement();
  const element = document.createElement("mdmark-view-upgrade") as ViewElement;
  element.columns = columns();
  element.items = items();
  document.body.append(element);
  elements.push(element);
  // 実行
  customElements.define(
    "mdmark-view-upgrade",
    class extends MdmarkViewElement {},
  );
  await flush();
  // 検証
  expect(element.querySelector("div.mdmark-view")).not.toBeNull();
});

// 取り除くと片付け、戻すと描き直す（正常系）
test("test_disconnected_callback", async () => {
  // 準備
  await loadElement();
  const { partModules, setPartModuleLoader } = await loadPartModules();
  partModules.clear();
  const { record, module } = recordingModule();
  setPartModuleLoader("view", async () => module);
  const element = createView();
  element.columns = columns();
  element.items = items();
  await flush();
  const parent = element.parentElement;
  // 実行
  element.remove();
  const detachesWhileRemoved = record.detaches;
  parent?.append(element);
  await flush();
  // 検証
  expect(detachesWhileRemoved).toBe(1);
  expect(record.draws).toBe(2);
});

// 同じマイクロタスクの代入を 1 回にまとめる（正常系）
test("test_schedule_render", async () => {
  // 準備
  await loadElement();
  const { partModules, setPartModuleLoader } = await loadPartModules();
  partModules.clear();
  const { record, module } = recordingModule();
  setPartModuleLoader("view", async () => module);
  const element = createView();
  // 実行
  element.columns = columns();
  element.items = items();
  element.group = "状態";
  await flush();
  // 検証
  expect(record.draws).toBe(1);
});

// 列名と項目からビューを描き、項目が data-key を持つ（正常系）
test("test_render_now", async () => {
  // 準備
  await loadElement();
  const element = createView();
  // 実行
  element.columns = columns();
  element.items = items();
  element.group = "状態";
  await flush();
  // 検証
  expect(element.children).toHaveLength(1);
  expect(element.firstElementChild?.classList.contains("mdmark")).toBe(true);
  const cards = [...element.querySelectorAll<HTMLElement>(".mdmark-view-card")];
  expect(cards.map((card) => card.dataset.key).sort()).toEqual([
    "T1",
    "T2",
    "T3",
  ]);
  expect(shownKeys(element)).toEqual(["T1", "T2", "T3"]);
});

// 誤った指定は例外を投げずに通知ブロックを描く（異常系）
test("test_render_now_when_invalid", async () => {
  // 準備
  await loadElement();
  const element = createView();
  element.columns = columns();
  // 実行
  const assign = () => {
    element.items = [items()[0], { ...items()[1], key: "T1" }];
  };
  expect(assign).not.toThrow();
  await flush();
  const noticeHtml = element.querySelector(".mdmark-notice")?.innerHTML ?? "";
  element.items = items();
  await flush();
  // 検証
  expect(noticeHtml).toContain("この箇所を表示できません");
  expect(noticeHtml).toContain("<code>items[1].key</code>");
  expect(element.querySelector(".mdmark-notice")).toBeNull();
  expect(element.querySelector("div.mdmark-view")).not.toBeNull();
});

// 項目の押下を要素のイベントで送信する（正常系）
test("test_render_now_when_item_clicked", async () => {
  // 準備
  await loadElement();
  const wrapper = document.createElement("div");
  document.body.append(wrapper);
  elements.push(wrapper);
  const element = createView(wrapper);
  element.columns = columns();
  element.items = items();
  element.group = "状態";
  await flush();
  const clicks = vi.fn();
  wrapper.addEventListener("mdmark-item-click", (event) =>
    clicks((event as CustomEvent).detail),
  );
  // 実行
  element
    .querySelector<HTMLElement>('.mdmark-view-card[data-key="T2"]')
    ?.click();
  // 検証
  expect(clicks).toHaveBeenCalledTimes(1);
  expect(clicks).toHaveBeenCalledWith({ key: "T2" });
});

// 項目を代入し直すと表示していたビューと絞り込みを保つ（正常系）
test("test_render_now_when_items_reassigned", async () => {
  // 準備
  await loadElement();
  const element = createView();
  element.columns = columns();
  element.items = items();
  element.group = "状態";
  element.filter = { 担当: "select" };
  await flush();
  element
    .querySelector<HTMLButtonElement>(
      '.mdmark-view-switch button[data-mode="table"]',
    )
    ?.click();
  element.querySelector<HTMLButtonElement>(".mdmark-filter")?.click();
  const checkbox = [
    ...element.querySelectorAll<HTMLInputElement>(
      ".mdmark-filter-drawer:not([hidden]) input[type=checkbox]",
    ),
  ].find((input) => input.closest("label")?.textContent?.includes("佐藤"));
  checkbox?.click();
  // 実行
  element.items = [
    ...items(),
    { key: "T4", values: { タイトル: "公開", 状態: "未着手", 担当: "佐藤" } },
  ];
  await flush();
  // 検証
  expect(element.querySelector<HTMLElement>(".mdmark-view-table")?.hidden).toBe(
    false,
  );
  expect(shownKeys(element)).toEqual(["T1", "T4"]);
});

// 未登録なら登録し、登録済みなら何もしない（正常系）
test("test_define_view_element", async () => {
  // 準備
  const { defineViewElement, MdmarkViewElement } = await loadElement();
  const define = vi.fn();
  const registered: Array<CustomElementConstructor | undefined> = [
    undefined,
    class extends HTMLElement {},
  ];
  const registry = {
    get: vi.fn(() => registered.shift()),
    define,
  } as unknown as CustomElementRegistry;
  // 実行
  defineViewElement(registry);
  defineViewElement(registry);
  // 検証
  expect(define).toHaveBeenCalledTimes(1);
  expect(define).toHaveBeenCalledWith("mdmark-view", MdmarkViewElement);
});
