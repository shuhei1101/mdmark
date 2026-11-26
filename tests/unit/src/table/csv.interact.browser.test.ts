import { afterEach, expect, test } from "vitest";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** CSV の表の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCsvRaw = () => import("../../../../src/table/csv.interact.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

/** 表の操作を読み込む（表のメニューの開閉を付ける） */
const loadTables = () => import("../../../../src/table/table.interact.ts");

/** 要素が `hidden` を持つか（要素が無ければ `undefined`） */
const hiddenOf = (element: Element | null | undefined) =>
  element ? element.hasAttribute("hidden") : undefined;

// 表のメニューの「元の CSV を表示」と「表で表示」で表と元の CSV を入れ替える（正常系）
test("test_attach_csv_raw", async () => {
  // 準備
  const { attachTables } = await loadTables();
  const { attachCsvRaw } = await loadCsvRaw();
  const { root } = createRoot("```csv\n名前,値\na,1\n```\n");
  detachers.push(attachTables(root), attachCsvRaw(root));
  const menuButton = root.querySelector<HTMLButtonElement>(
    "button.mdmark-table-menu",
  );
  const scroll = root.querySelector<HTMLElement>(".mdmark-table-scroll");
  const raw = root.querySelector<HTMLElement>("pre.mdmark-raw");
  const toggle = root.querySelector<HTMLButtonElement>(
    "button.mdmark-raw-toggle",
  );
  // 実行: 表のメニューの「元の CSV を表示」
  menuButton?.click();
  root
    .querySelector<HTMLButtonElement>(
      'button.mdmark-table-menu-item[data-action="raw"]',
    )
    ?.click();
  // 検証
  expect(hiddenOf(root.querySelector(".mdmark-table-menu-panel"))).toBe(true);
  expect(hiddenOf(scroll)).toBe(true);
  expect(hiddenOf(menuButton)).toBe(true);
  expect(hiddenOf(raw)).toBe(false);
  expect(hiddenOf(toggle)).toBe(false);
  expect(document.activeElement).toBe(toggle);
  // 実行: 「表で表示」
  toggle?.click();
  // 検証
  expect(hiddenOf(scroll)).toBe(false);
  expect(hiddenOf(menuButton)).toBe(false);
  expect(hiddenOf(raw)).toBe(true);
  expect(hiddenOf(toggle)).toBe(true);
  expect(document.activeElement).toBe(menuButton);
});
