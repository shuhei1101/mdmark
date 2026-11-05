import { afterEach, expect, test } from "vitest";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** CSV の表の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCsvRaw = () => import("../../../../src/interact/csv-raw.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

// 押すたびに表と元の CSV を入れ替える（正常系）
test("test_attach_csv_raw", async () => {
  // 準備
  const { attachCsvRaw } = await loadCsvRaw();
  const { root } = createRoot("```csv\n名前,値\na,1\n```\n");
  detachers.push(attachCsvRaw(root));
  const button = root.querySelector<HTMLButtonElement>(".mdmark-raw-toggle");
  const table = root.querySelector<HTMLTableElement>("table");
  const raw = root.querySelector<HTMLElement>("pre.mdmark-raw");
  // 実行
  button?.click();
  const afterFirst = {
    table: table?.hidden,
    raw: raw?.hidden,
    pressed: button?.getAttribute("aria-pressed"),
  };
  button?.click();
  const afterSecond = {
    table: table?.hidden,
    raw: raw?.hidden,
    pressed: button?.getAttribute("aria-pressed"),
  };
  // 検証
  expect(afterFirst).toEqual({ table: true, raw: false, pressed: "true" });
  expect(afterSecond).toEqual({ table: false, raw: true, pressed: "false" });
});
