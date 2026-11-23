import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows, resolveColor } from "../story.ts";

const holder = createBrowserHolder();

/** 広い幅の状態を開く画面の大きさ（部品設計の状態の幅 1280px） */
const WIDE = { width: 1400, height: 900 };

beforeAll(holder.launch);
afterAll(holder.close);

/** 広い幅の列ごとの、セルの中身の種類（変えていない・削除の色・追加の色・空き）と上端 */
function columns(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".mdmark-diff-pair-col")].map((column) => ({
      label: column.getAttribute("aria-labelledby"),
      head:
        document.getElementById(column.getAttribute("aria-labelledby") ?? "")
          ?.textContent ?? "",
      cells: [...column.querySelectorAll(".mdmark-diff-pair-cell")].map(
        (cell) => ({
          kind: cell.querySelector(".mdmark-diff-pair-gap")
            ? "gap"
            : (cell.querySelector("[data-kind]")?.getAttribute("data-kind") ??
              "same"),
          top: cell.getBoundingClientRect().top,
          height: cell.getBoundingClientRect().height,
          gapHidden:
            cell
              .querySelector(".mdmark-diff-pair-gap")
              ?.getAttribute("aria-hidden") ?? null,
        }),
      ),
    })),
  );
}

/** 表示しているほうの並び */
function shown(page: Page) {
  return page.evaluate(() => ({
    pair:
      getComputedStyle(document.querySelector(".mdmark-diff-pair") as Element)
        .display !== "none",
    stacked:
      getComputedStyle(
        document.querySelector(".mdmark-diff-pair-stacked") as Element,
      ).display !== "none",
  }));
}

/** 広い幅の前の列と後の列（2 つ無ければ失敗させる） */
async function pairColumns(page: Page) {
  const [before, after] = await columns(page);
  if (!before || !after) throw new Error("列が 2 つ無い");
  return { before, after };
}

/** 2 列のセルが同じ行で上端をそろえていることを確かめる */
async function expectAligned(page: Page): Promise<void> {
  const { before, after } = await pairColumns(page);
  expect(before.head.startsWith("前: ")).toBe(true);
  expect(after.head.startsWith("後: ")).toBe(true);
  expect(before.cells.map((cell) => cell.kind)).toEqual([
    "same",
    "del",
    "del",
    "same",
    "gap",
  ]);
  expect(after.cells.map((cell) => cell.kind)).toEqual([
    "same",
    "add",
    "gap",
    "same",
    "add",
  ]);
  const afterTops = after.cells.map((cell) => cell.top);
  expect(
    before.cells.map(
      (cell, index) => Math.abs(cell.top - (afterTops[index] ?? 0)) < 1,
    ),
  ).toEqual(before.cells.map(() => true));
  const gaps = [...before.cells, ...after.cells].filter(
    (cell) => cell.kind === "gap",
  );
  expect(gaps.map((cell) => cell.gapHidden)).toEqual(gaps.map(() => "true"));
}

// 広い幅の 2 列に、変えていないブロックと書き換えたブロックを同じ高さで向かい合わせ、対の無い向かいに斜線の空きを入れる（Wide）
test("test_wide", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffsidebyside--wide", WIDE);
  // 検証
  await expect(shown(page)).resolves.toEqual({ pair: true, stacked: false });
  await expectAligned(page);
  const background = await page
    .locator(".mdmark-diff-pair-gap")
    .first()
    .evaluate((gap) => getComputedStyle(gap).backgroundImage);
  expect(background).toContain("repeating-linear-gradient");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 右の追加した段落が長いと、向かいの空きが段落の高さに合わせて伸びる（LongBlock）
test("test_long_block", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffsidebyside--long-block", WIDE);
  // 検証
  const { before, after } = await pairColumns(page);
  const added = after.cells.at(-1);
  const gap = before.cells.at(-1);
  if (!added || !gap) throw new Error("最後の行が無い");
  expect([gap.kind, added.kind]).toEqual(["gap", "add"]);
  expect(Math.abs(gap.height - added.height)).toBeLessThan(1);
  expect(added.height).toBeGreaterThan(48);
});

// 幅 390px では 1 列で、変えたブロックだけ前の見出しと削除の色の下に後の見出しと追加の色を並べ、変えていないブロックは 1 回だけ出す（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffsidebyside--narrow");
  // 検証
  await expect(shown(page)).resolves.toEqual({ pair: false, stacked: true });
  const order = await page
    .locator(".mdmark-diff-pair-stacked")
    .evaluate((stacked) =>
      [...stacked.children].map((child) =>
        child.matches(".mdmark-diff-pair-label")
          ? (child.textContent ?? "").slice(0, 2)
          : (child.getAttribute("data-kind") ?? child.tagName.toLowerCase()),
      ),
    );
  expect(order).toEqual([
    "h2",
    "前:",
    "del",
    "後:",
    "add",
    "前:",
    "del",
    "table",
    "後:",
    "add",
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ダークの配色でも、Wide と同じ並びで差分のブロックの色を使用する（Dark）
test("test_dark", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffsidebyside--dark", WIDE);
  // 検証
  await expectAligned(page);
  const actual = await page
    .locator('.mdmark-diff-pair [data-kind="add"]')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(actual).toBe(
    await resolveColor(page, "var(--mdmark-color-diff-add-bg)"),
  );
});
