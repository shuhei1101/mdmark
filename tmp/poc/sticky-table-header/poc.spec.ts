import { expect, type Page, test } from "@playwright/test";
import {
  alignError,
  installMeasure,
  middleY,
  record,
  type Snapshot,
  scrollAndMeasure,
  scrollTableAndMeasure,
  stickError,
  TOLERANCE,
} from "./measure.ts";

// 追従の遅れを測るスクロールの回数
const FOLLOW_STEPS = 30;
// 検証ページのパス
const PAGE_PATH = "/tmp/poc/sticky-table-header/page.html";

/** 見えている見出し行の、列の番号のセルの中のボタンの中心 */
async function headButtonCenter(page: Page, column: number, selector: string): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ column, selector }) => {
      const poc = (window as never as { poc: { parts: { headCells(): Element[] }[] } }).poc;
      const button = poc.parts[0].headCells()[column].querySelector(selector) as HTMLElement;
      const b = button.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    },
    { column, selector },
  );
}

/** 元の見出し行のセルの属性 */
async function originalAttr(page: Page, column: number, selector: string, name: string): Promise<string | null> {
  return page.evaluate(
    ({ column, selector, name }) => {
      const table = (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0];
      const cell = table.tHead?.rows[0].cells[column] as HTMLElement;
      const el = selector ? cell.querySelector(selector) : cell;
      return el?.getAttribute(name) ?? null;
    },
    { column, selector, name },
  );
}

/** 横にはみ出す表で、先頭の列をピン止めする */
async function pinFirstColumn(page: Page): Promise<void> {
  await page.evaluate(() => {
    const table = (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0];
    (table.tHead?.rows[0].cells[0].querySelector(".mdmark-pin") as HTMLElement).click();
  });
}

async function open(page: Page, mode: string, offset: number): Promise<void> {
  await page.addInitScript(installMeasure);
  await page.goto(`${PAGE_PATH}?mode=${mode}&offset=${offset}`);
  await page.waitForSelector("html[data-ready='1']");
}

for (const mode of ["a", "c"]) {
  test.describe(`mode ${mode}`, () => {
    // 縦に留まる・表から外れる（ずれ 0 と 48px）
    for (const offset of [0, 48]) {
      test(`stick_when_offset_${offset}`, async ({ page }, info) => {
        // 準備
        await open(page, mode, offset);
        const mid = await middleY(page);
        // 実行
        const errors: number[] = [];
        for (const delta of [-1500, -500, 0, 500, 1500]) {
          errors.push(stickError(await scrollAndMeasure(page, mid + delta)));
        }
        const before = await scrollAndMeasure(page, 0);
        const after = await page.evaluate(async () => {
          const table = (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0];
          window.scrollTo(0, table.getBoundingClientRect().bottom + scrollY + 10);
          await new Promise((resolve) => requestAnimationFrame(resolve));
          return (window as never as { __measure(): Snapshot }).__measure();
        });
        // 検証
        const stick = Math.max(...errors);
        record(info.project.name, mode, `縦に留まる(ずれ${offset})`, stick);
        expect.soft(stick).toBeLessThanOrEqual(TOLERANCE);
        // 表が画面の下にある間は集計の行が画面の下へ外れ、表が画面の上へ出たら見出し行が外れる
        const footOut = Math.min(...before.foot.map((c) => c.top)) >= before.ih - TOLERANCE;
        const headOut = Math.max(...after.head.map((c) => c.bottom)) <= TOLERANCE;
        record(info.project.name, mode, `表から外れる(ずれ${offset})`, { footOut, headOut });
        expect.soft(footOut && headOut).toBe(true);
      });
    }

    // 横に揃う・追従の遅れ
    test("align_and_follow", async ({ page }, info) => {
      // 準備
      await open(page, mode, 0);
      await pinFirstColumn(page);
      const mid = await middleY(page);
      const s0 = await scrollAndMeasure(page, mid);
      // 実行・検証: 横のスクロールの左端・中ほど・右端
      const alignErrors: number[] = [];
      for (const x of [0, s0.maxScrollLeft / 2, s0.maxScrollLeft]) {
        alignErrors.push(alignError(await scrollTableAndMeasure(page, x)));
      }
      const align = Math.max(...alignErrors);
      record(info.project.name, mode, "横に揃う(ピン止め含む)", align);
      expect.soft(align).toBeLessThanOrEqual(TOLERANCE);
      // ピン止めした先頭の列は、表の左端に留まる
      const pinned = await scrollTableAndMeasure(page, s0.maxScrollLeft);
      const pinError = Math.abs((pinned.head[0].left ?? 0) - (pinned.body?.[0].left ?? Number.NaN));
      record(info.project.name, mode, "ピン止めした列", pinError);
      expect.soft(pinError).toBeLessThanOrEqual(TOLERANCE);
      // 追従の遅れ: 縦と横に 30 回ずつスクロールし、次のフレームで計る
      await scrollTableAndMeasure(page, 0);
      let followV = 0;
      let followH = 0;
      for (let i = 0; i < FOLLOW_STEPS; i++) {
        followV = Math.max(followV, stickError(await scrollAndMeasure(page, mid - 800 + i * 53)));
      }
      for (let i = 0; i < FOLLOW_STEPS; i++) {
        followH = Math.max(followH, alignError(await scrollTableAndMeasure(page, (s0.maxScrollLeft * i) / FOLLOW_STEPS)));
      }
      record(info.project.name, mode, "追従の遅れ(縦/横)", { followV, followH });
      expect.soft(Math.max(followV, followH)).toBeLessThanOrEqual(TOLERANCE);
    });

    // ボタンと状態・幅の変化
    test("buttons_and_width_changes", async ({ page }, info) => {
      // 準備
      await open(page, mode, 0);
      const mid = await middleY(page);
      await scrollAndMeasure(page, mid);
      // 実行: 留めた見出し行の「単価」の並べ替えを、画面の座標で押す
      const sort = await headButtonCenter(page, 3, ".mdmark-sort");
      await page.mouse.click(sort.x, sort.y);
      const ariaSort = await originalAttr(page, 3, "", "aria-sort");
      // 実行: 「区分」の絞り込みのボタンを押し、パネルの位置を計る
      await scrollAndMeasure(page, mid);
      const filter = await headButtonCenter(page, 1, ".mdmark-filter");
      await page.mouse.click(filter.x, filter.y);
      const expanded = await originalAttr(page, 1, ".mdmark-filter", "aria-expanded");
      const drawerGap = await page.evaluate((buttonY) => {
        const drawer = document.querySelector(".mdmark-filter-drawer:not([hidden])") as HTMLElement | null;
        return drawer ? drawer.getBoundingClientRect().top - buttonY : null;
      }, filter.y);
      // 絞り込み: 先頭の候補（区分 A）だけにする
      await page.evaluate(() => {
        const drawer = document.querySelector(".mdmark-filter-drawer:not([hidden])") as HTMLElement;
        const box = drawer.querySelector(".mdmark-filter-options input") as HTMLInputElement;
        box.click();
      });
      await page.keyboard.press("Escape");
      // 実行: 「区分」のピン止めを押す
      await scrollAndMeasure(page, mid);
      const pin = await headButtonCenter(page, 1, ".mdmark-pin");
      await page.mouse.click(pin.x, pin.y);
      const pressed = await originalAttr(page, 1, ".mdmark-pin", "aria-pressed");
      // 列の表示: 「備考1」を隠す
      await page.evaluate(() => {
        const toggle = [...document.querySelectorAll<HTMLElement>(".mdmark-table-tool")].find((b) =>
          b.textContent?.includes("列"),
        );
        toggle?.click();
        const item = [...document.querySelectorAll<HTMLLabelElement>(".mdmark-columns-options label")].find((l) =>
          l.textContent?.includes("備考1"),
        );
        item?.querySelector("input")?.click();
      });
      await page.keyboard.press("Escape");
      const afterChanges = alignError(await scrollAndMeasure(page, await middleY(page)));
      // 画面の幅を 1280 → 390 → 1280px と変える
      await page.setViewportSize({ width: 390, height: 800 });
      const narrow = alignError(await scrollAndMeasure(page, await middleY(page)));
      await page.setViewportSize({ width: 1280, height: 800 });
      const wide = alignError(await scrollAndMeasure(page, await middleY(page)));
      // 検証
      record(info.project.name, mode, "ボタンと状態", { ariaSort, expanded, drawerGap, pressed });
      expect.soft(ariaSort).toBe("ascending");
      expect.soft(expanded).toBe("true");
      expect.soft(drawerGap).not.toBeNull();
      expect.soft(drawerGap ?? -1).toBeGreaterThanOrEqual(0);
      expect.soft(drawerGap ?? 99).toBeLessThanOrEqual(40);
      expect.soft(pressed).toBe("true");
      record(info.project.name, mode, "幅の変化(操作後/390/1280)", { afterChanges, narrow, wide });
      expect.soft(Math.max(afterChanges, narrow, wide)).toBeLessThanOrEqual(TOLERANCE);
    });

    // フォーカスと読み上げ・印刷
    test("focus_and_print", async ({ page }, info) => {
      // 準備
      await open(page, mode, 0);
      await scrollAndMeasure(page, await middleY(page));
      // 実行: アクセシビリティツリーの見出しのセルと絞り込みのボタンの数
      const columnheaders = await page.getByRole("columnheader").count();
      const filterButtons = await page.getByRole("button", { name: /で絞り込む/ }).count();
      const originalFilters = await page.evaluate(
        () => [...document.querySelectorAll("thead .mdmark-filter")].filter((b) => !b.closest(".poc-clone")).length,
      );
      // 実行: 文書の頭から Tab で進み、フォーカスが移った先を集める
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.evaluate(() => window.scrollTo(0, 0));
      const visited: { inClone: boolean; key: string }[] = [];
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press("Tab");
        visited.push(
          await page.evaluate(() => {
            const el = document.activeElement as HTMLElement;
            const th = el.closest("th");
            return {
              inClone: !!el.closest(".poc-clone"),
              key: th ? `${th.cellIndex}:${el.className}` : "",
            };
          }),
        );
      }
      // 見出し行に入ってから出るまでの 1 巡だけを見る
      const first = visited.findIndex((v) => v.key);
      const last = visited.findIndex((v, i) => i > first && !v.key);
      // Firefox は最後のボタンの後でフォーカスがページの外へ出て、同じ要素のまま残るので、続けて同じ要素は 1 回にする
      const headKeys = visited
        .slice(first, last === -1 ? undefined : last)
        .map((v) => v.key)
        .filter((key, i, keys) => key !== keys[i - 1]);
      const duplicated = headKeys.length !== new Set(headKeys).size;
      const intoClone = visited.some((v) => v.inClone);
      // 実行: 印刷のメディア
      await page.emulateMedia({ media: "print" });
      const print = await page.evaluate(() => {
        const table = (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0];
        const shifted = [...(table.tHead?.rows[0].cells ?? [])].some((c) => getComputedStyle(c).transform !== "none");
        const clones = [...document.querySelectorAll(".poc-clone")].filter(
          (c) => getComputedStyle(c).display !== "none",
        ).length;
        return { shifted, clones };
      });
      await page.emulateMedia({ media: "screen" });
      // 検証
      record(info.project.name, mode, "フォーカスと読み上げ", {
        columnheaders,
        filterButtons,
        originalFilters,
        headFocus: headKeys.length,
        duplicated,
        intoClone,
      });
      expect.soft(columnheaders).toBe(12);
      expect.soft(filterButtons).toBe(originalFilters);
      expect.soft(duplicated).toBe(false);
      expect.soft(intoClone).toBe(false);
      record(info.project.name, mode, "印刷", print);
      expect.soft(print).toEqual({ shifted: false, clones: 0 });
    });
  });
}
