import { appendFile, copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Frame, test } from "@playwright/test";
import { useVscodeE2E } from "../../../tests/e2e/vscode.ts";
import {
  alignError,
  installMeasure,
  middleY,
  record,
  scrollAndMeasure,
  scrollTableAndMeasure,
  stickError,
  TOLERANCE,
} from "./measure.ts";

// 計る留め方（a: 複製 / b: スクロール連動のアニメーション / c: 元のセルを動かす）
const MODE = process.env.POC_MODE ?? "c";

const e2e = useVscodeE2E();

/** 配布物を、mount の後に PoC の留める処理を付ける入口へ差し替える */
test.beforeAll(async () => {
  const dist = join(e2e.built().distRoot, "dist");
  await rename(join(dist, "index.js"), join(dist, "index.orig.js"));
  await copyFile(join(import.meta.dirname, "sticky.js"), join(dist, "poc-sticky.js"));
  await writeFile(
    join(dist, "index.js"),
    [
      'export * from "./index.orig.js";',
      'import { mount as baseMount } from "./index.orig.js";',
      'import { install } from "./poc-sticky.js";',
      "export function mount(el, opts) {",
      "  const handle = baseMount(el, opts);",
      `  window.poc = install(el, ${JSON.stringify(MODE)});`,
      "  return handle;",
      "}",
      "",
    ].join("\n"),
  );
  await appendFile(join(dist, "index.css"), await readFile(join(import.meta.dirname, "sticky.css")));
});

/** 検証ページと同じ表（200 行 × 12 列・絞り込み・集計の行）と、前後の本文 */
function tableMarkdown(): string {
  const columns = ["名前", "区分", "数量", "単価", "担当", "状態", "開始日", "終了日", "場所", "備考1", "備考2", "備考3"];
  const rows = Array.from({ length: 200 }, (_, i) => [
    `項目 ${i + 1}`,
    ["A", "B", "C"][i % 3],
    String((i * 7) % 50),
    String(100 + i),
    `担当者 ${i % 9}`,
    ["未着手", "進行中", "完了"][i % 3],
    "2026-10-01",
    "2026-11-30",
    `第 ${i % 5} 倉庫の棚`,
    "長めの備考の文字列が入るセル",
    "長めの備考の文字列が入るセル",
    "長めの備考の文字列が入るセル",
  ]);
  const filler = Array.from({ length: 30 }, (_, i) => `表の前後の本文 ${i + 1}`).join("\n\n");
  return [
    "# PoC",
    "",
    filler,
    "",
    "<!-- table: data +columns +total filter=区分,状態 total=数量:sum,単価:avg -->",
    "",
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
    "",
    "<!-- /table -->",
    "",
    filler,
    "",
  ].join("\n");
}

/** 見えている見出し行の列のボタンのセレクタ（案 A は複製、案 C は元） */
function headButton(column: number, cls: string): string {
  const scope = MODE === "a" ? ".poc-clone:not([hidden]) thead" : ".mdmark-table table thead";
  return `${scope} tr > :nth-child(${column + 1}) ${cls}`;
}

/** 元の見出し行のセルの属性 */
async function originalAttr(frame: Frame, column: number, selector: string, name: string): Promise<string | null> {
  return frame.evaluate(
    ({ column, selector, name }) => {
      const table = (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0];
      const cell = table.tHead?.rows[0].cells[column] as HTMLElement;
      const el = selector ? cell.querySelector(selector) : cell;
      return el?.getAttribute(name) ?? null;
    },
    { column, selector, name },
  );
}

// VS Code 拡張機能のプレビューで、縦に留まる・横に揃う・ボタンと状態を確かめる
test(`vscode_preview_mode_${MODE}`, async () => {
  // 準備
  const session = await e2e.launch({ files: { "table.md": tableMarkdown() } });
  await session.openFile("table.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith(".mdmark-table table");
  await frame.waitForFunction(() => "poc" in window);
  await frame.evaluate(installMeasure);
  const mid = await middleY(frame);
  // 実行・検証: 縦に留まる
  const stickErrors: number[] = [];
  for (const delta of [-1500, -500, 0, 500, 1500]) {
    stickErrors.push(stickError(await scrollAndMeasure(frame, mid + delta)));
  }
  const stick = Math.max(...stickErrors);
  record("vscode", MODE, "縦に留まる(ずれ0)", stick);
  expect.soft(stick).toBeLessThanOrEqual(TOLERANCE);
  // 実行・検証: 横に揃う（先頭の列をピン止めして、左端・中ほど・右端）
  await frame.evaluate(() => {
    const table = (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0];
    (table.tHead?.rows[0].cells[0].querySelector(".mdmark-pin") as HTMLElement).click();
  });
  const s0 = await scrollAndMeasure(frame, mid);
  const alignErrors: number[] = [];
  for (const x of [0, s0.maxScrollLeft / 2, s0.maxScrollLeft]) {
    alignErrors.push(alignError(await scrollTableAndMeasure(frame, x)));
  }
  const align = Math.max(...alignErrors);
  record("vscode", MODE, "横に揃う(ピン止め含む)", align);
  expect.soft(align).toBeLessThanOrEqual(TOLERANCE);
  // 実行・検証: ボタンと状態（留めた見出し行のボタンを押す）
  await scrollTableAndMeasure(frame, 0);
  await scrollAndMeasure(frame, mid);
  await frame.locator(headButton(3, ".mdmark-sort")).click();
  const ariaSort = await originalAttr(frame, 3, "", "aria-sort");
  await scrollAndMeasure(frame, mid);
  await frame.locator(headButton(1, ".mdmark-filter")).click();
  const expanded = await originalAttr(frame, 1, ".mdmark-filter", "aria-expanded");
  const drawerGap = await frame.evaluate((selector) => {
    const button = document.querySelector(selector) as HTMLElement;
    const drawer = document.querySelector(".mdmark-filter-drawer:not([hidden])") as HTMLElement | null;
    return drawer ? drawer.getBoundingClientRect().top - button.getBoundingClientRect().bottom : null;
  }, headButton(1, ".mdmark-filter"));
  await frame.locator("body").press("Escape");
  await scrollAndMeasure(frame, mid);
  await frame.locator(headButton(1, ".mdmark-pin")).click();
  const pressed = await originalAttr(frame, 1, ".mdmark-pin", "aria-pressed");
  record("vscode", MODE, "ボタンと状態", { ariaSort, expanded, drawerGap, pressed });
  expect.soft(ariaSort).toBe("ascending");
  expect.soft(expanded).toBe("true");
  expect.soft(drawerGap ?? -1).toBeGreaterThanOrEqual(0);
  expect.soft(pressed).toBe("true");
});
