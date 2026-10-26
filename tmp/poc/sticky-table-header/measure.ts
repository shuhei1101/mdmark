import type { Frame, Page } from "@playwright/test";

// PoC の計測: ページ（Playwright）と VS Code のプレビューで同じ関数を使う

// 位置と幅のずれの許容（px）
export const TOLERANCE = 1;

export type Box = { left: number; width: number; top: number; bottom: number };
export type Snapshot = {
  off: number;
  ih: number;
  head: Box[];
  foot: Box[];
  body: Box[] | null;
  scrollLeft: number;
  maxScrollLeft: number;
  table: Box;
};

// ─── 計測 ───

/** ページに計測の関数を置く（見えている見出し行・集計の行と、重なっていない本文の行のセルの位置） */
export function installMeasure(): void {
  const box = (el: Element) => {
    const b = el.getBoundingClientRect();
    return { left: b.left, width: b.width, top: b.top, bottom: b.bottom };
  };
  Object.assign(window, {
    __measure: () => {
      const poc = (window as never as { poc: { parts: { headCells(): Element[]; footCells(): Element[] }[]; tables: HTMLTableElement[] } }).poc;
      const part = poc.parts[0];
      const table = poc.tables[0];
      const off =
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--poc-sticky-top")) || 0;
      const head = part.headCells().map(box);
      const foot = part.footCells().map(box);
      const headH = head[0].bottom - head[0].top;
      const footH = foot.length ? foot[0].bottom - foot[0].top : 0;
      const row = [...table.tBodies[0].rows].find((r) => {
        const b = r.getBoundingClientRect();
        return r.cells.length === head.length && b.top > off + headH + 2 && b.bottom < innerHeight - footH - 2;
      });
      return {
        off,
        ih: innerHeight,
        head,
        foot,
        body: row ? [...row.cells].map(box) : null,
        scrollLeft: table.scrollLeft,
        maxScrollLeft: table.scrollWidth - table.clientWidth,
        table: box(table),
      };
    },
  });
}

/** 次のフレームまで待ってから計る */
export async function measure(page: Page | Frame): Promise<Snapshot> {
  return page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return (window as never as { __measure(): Snapshot }).__measure();
  });
}

/** ページを縦にスクロールし、次のフレームで計る */
export async function scrollAndMeasure(page: Page | Frame, y: number): Promise<Snapshot> {
  return page.evaluate(async (top) => {
    window.scrollTo(0, top);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return (window as never as { __measure(): Snapshot }).__measure();
  }, y);
}

/** 表を横にスクロールし、次のフレームで計る */
export async function scrollTableAndMeasure(page: Page | Frame, left: number): Promise<Snapshot> {
  return page.evaluate(async (x) => {
    (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0].scrollLeft = x;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return (window as never as { __measure(): Snapshot }).__measure();
  }, left);
}

/** 表の中ほど（表の上端が画面の上へ出て、表の下端がまだ下にある位置）のページのスクロール量 */
export async function middleY(page: Page | Frame): Promise<number> {
  return page.evaluate(() => {
    const table = (window as never as { poc: { tables: HTMLTableElement[] } }).poc.tables[0];
    return table.getBoundingClientRect().top + scrollY + 2000;
  });
}

/** 見出し行・集計の行のセルが、本文の行のセルと横の位置と幅で揃っているときの最大のずれ */
export function alignError(s: Snapshot): number {
  if (!s.body) {
    throw new Error("重なっていない本文の行が画面にありません");
  }
  let max = 0;
  for (const cells of [s.head, s.foot]) {
    cells.forEach((cell, index) => {
      const body = s.body?.[index];
      if (!body || body.width === 0) {
        return;
      }
      max = Math.max(max, Math.abs(cell.left - body.left), Math.abs(cell.width - body.width));
    });
  }
  return max;
}

/** 見出し行が画面の上端（ずれの下）、集計の行が画面の下端に留まっているときの最大のずれ */
export function stickError(s: Snapshot): number {
  const head = Math.max(...s.head.map((c) => Math.abs(c.top - s.off)));
  const foot = Math.max(...s.foot.map((c) => Math.abs(c.bottom - s.ih)));
  return Math.max(head, foot);
}

/** 結果を 1 行で出す（PoC 結果の表に写す） */
export function record(project: string, mode: string, criterion: string, value: unknown): void {
  console.log(`POC|${project}|${mode}|${criterion}|${JSON.stringify(value)}`);
}

