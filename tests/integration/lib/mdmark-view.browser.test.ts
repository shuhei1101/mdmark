import { afterEach, expect, inject, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type {
  MdmarkViewItem,
  MdmarkViewItemClickDetail,
} from "../../../src/index.ts";

/** ビューのカスタム要素のプロパティ */
type ViewElement = HTMLElement & {
  columns?: unknown;
  items?: unknown;
  group?: unknown;
  filter?: unknown;
};

const placed: HTMLElement[] = [];
let built: Promise<unknown> | undefined;
let stylesheetLoaded: Promise<void> | undefined;

afterEach(() => {
  for (const element of placed.splice(0)) {
    element.remove();
  }
  window.getSelection()?.removeAllRanges();
  sessionStorage.clear();
});

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
const distUrl = (file: string): string =>
  `/@fs${inject("builtRoot")}/dist/${file}`;

/** ビルドした CSS と JS を 1 度だけ読み込み、部品のカスタム要素を登録した状態にする */
const loadBuilt = async (): Promise<void> => {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  await stylesheetLoaded;
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  await built;
};

/** 要素をページに配置し、後ろに文字 `後ろの段落` の `p` を続ける */
const place = <T extends HTMLElement>(element: T): T => {
  const wrapper = document.createElement("div");
  const after = document.createElement("p");
  after.className = "after";
  after.textContent = "後ろの段落";
  wrapper.append(element, after);
  document.body.append(wrapper);
  placed.push(wrapper);
  return element;
};

/** タイトル・状態・担当の 3 列と 5 件（1 件目のタイトルは HTML の文字） */
const items = (): MdmarkViewItem[] => [
  {
    key: "T1",
    values: {
      タイトル: "<script>alert(1)</script>設計",
      状態: "未着手",
      担当: "佐藤",
    },
  },
  { key: "T2", values: { タイトル: "実装", 状態: "進行中", 担当: "鈴木" } },
  { key: "T3", values: { タイトル: "確認", 状態: "未着手", 担当: "田中" } },
  { key: "T4", values: { タイトル: "公開", 状態: "完了", 担当: "佐藤" } },
  { key: "T5", values: { タイトル: "整理", 状態: "進行中", 担当: "鈴木" } },
];

/** 正常系と同じ指定を代入した <mdmark-view> を描く */
const drawView = async (): Promise<ViewElement> => {
  await loadBuilt();
  const element = place(document.createElement("mdmark-view") as ViewElement);
  element.columns = ["タイトル", "状態", "担当"];
  element.items = items();
  element.group = "状態";
  element.filter = { 担当: "select" };
  await vi.waitFor(() =>
    expect(element.querySelector(".mdmark-view")).not.toBeNull(),
  );
  return element;
};

/** 表形式の行のうち、隠れていない行のキー */
const shownKeys = (element: HTMLElement): string[] =>
  [
    ...element.querySelectorAll<HTMLTableRowElement>(
      ".mdmark-view-table tbody tr[data-key]",
    ),
  ]
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.key ?? "");

/** 表形式に切り替える */
const showTable = (element: HTMLElement): void => {
  element
    .querySelector<HTMLButtonElement>(
      '.mdmark-view-switch button[data-mode="table"]',
    )
    ?.click();
};

/** 担当の絞り込みで 1 人を選ぶ */
const filterOwner = (element: HTMLElement, name: string): void => {
  element.querySelector<HTMLButtonElement>(".mdmark-filter")?.click();
  const checkbox = [
    ...element.querySelectorAll<HTMLInputElement>(
      ".mdmark-filter-drawer:not([hidden]) input[type=checkbox]",
    ),
  ].find((input) => input.closest("label")?.textContent?.includes(name));
  checkbox?.click();
};

// 列名と項目からボード表示を描き、表形式に切り替えて絞り込む（正常系）
test("test_normal", async () => {
  // 準備・実行
  const element = await drawView();
  // 検証: ボードの 3 列と切り替え
  expect(element.querySelectorAll(":scope > .mdmark")).toHaveLength(1);
  expect(element.querySelectorAll(".mdmark-view-column")).toHaveLength(3);
  expect(element.querySelector(".mdmark-view-switch")).not.toBeNull();
  // 検証: HTML の文字は文字のまま出す
  expect(element.querySelector("script")).toBeNull();
  expect(element.textContent).toContain("<script>alert(1)</script>設計");
  // 実行: 表形式に切り替えて担当で絞り込む
  showTable(element);
  expect(shownKeys(element)).toEqual(["T1", "T2", "T3", "T4", "T5"]);
  filterOwner(element, "佐藤");
  // 検証
  expect(shownKeys(element)).toEqual(["T1", "T4"]);
  // 実行: 項目を指定し直す
  element.items = [...items()];
  await vi.waitFor(() => expect(shownKeys(element)).toEqual(["T1", "T4"]));
  // 検証: 表形式と絞り込みの選択が残る
  expect(element.querySelector<HTMLElement>(".mdmark-view-table")?.hidden).toBe(
    false,
  );
});

// 項目を押すか、フォーカスして Enter を押すと、項目の押下のイベントを送信する（正常系）
test("test_normal_when_item_clicked", async () => {
  // 準備
  const element = await drawView();
  const keys: string[] = [];
  element.addEventListener("mdmark-item-click", (event) => {
    keys.push((event as CustomEvent<MdmarkViewItemClickDetail>).detail.key);
  });
  // 実行: ボードの T2 の項目を押す
  element
    .querySelector<HTMLElement>('.mdmark-view-card[data-key="T2"]')
    ?.click();
  // 検証
  expect(keys).toEqual(["T2"]);
  // 実行: 表形式の T3 の行にフォーカスして Enter を押す
  showTable(element);
  element
    .querySelector<HTMLElement>('.mdmark-view-table tr[data-key="T3"]')
    ?.focus();
  await userEvent.keyboard("{Enter}");
  // 検証
  expect(keys).toEqual(["T2", "T3"]);
  // 実行: 切り替え・並べ替え・絞り込みのボタンを押す
  element
    .querySelector<HTMLButtonElement>(
      '.mdmark-view-switch button[data-mode="board"]',
    )
    ?.click();
  showTable(element);
  element.querySelector<HTMLButtonElement>(".mdmark-sort")?.click();
  element.querySelector<HTMLButtonElement>(".mdmark-filter")?.click();
  // 検証: 届かない
  expect(keys).toEqual(["T2", "T3"]);
});

// 指定に誤りがあると、例外を投げずに要素の中へ通知ブロックを配置する（異常系）
test("test_error_when_data_invalid", async () => {
  // 準備
  await loadBuilt();
  const cases: Array<{ assign: (element: ViewElement) => void; name: string }> =
    [
      {
        assign: (element) => {
          element.items = "T1";
        },
        name: "items",
      },
      {
        assign: (element) => {
          element.items = [items()[0], { ...items()[1], key: "T1" }];
        },
        name: "items[1].key",
      },
      {
        assign: (element) => {
          element.items = items();
          element.group = "優先度";
        },
        name: "group",
      },
    ];
  for (const { assign, name } of cases) {
    const element = place(document.createElement("mdmark-view") as ViewElement);
    element.columns = ["タイトル", "状態", "担当"];
    // 実行
    expect(() => assign(element)).not.toThrow();
    // 検証
    await vi.waitFor(() =>
      expect(element.querySelector(".mdmark-notice")).not.toBeNull(),
    );
    const notice = element.querySelector(".mdmark-notice");
    expect(notice?.getAttribute("role")).toBe("status");
    expect(notice?.textContent).toContain("この箇所を表示できません");
    expect(notice?.innerHTML).toContain(`<code>${name}</code>`);
    expect(element.parentElement?.querySelector(".after")?.textContent).toBe(
      "後ろの段落",
    );
    // 実行: 正しい指定を代入し直す
    element.items = items();
    element.group = "状態";
    // 検証
    await vi.waitFor(() =>
      expect(element.querySelector(".mdmark-view")).not.toBeNull(),
    );
    expect(element.querySelector(".mdmark-notice")).toBeNull();
  }
});
