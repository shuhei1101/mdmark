import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 1280px の画面 */
const WIDE_VIEWPORT = { width: 1280, height: 800 };

/** カードの格子のストーリーを開く */
function open(id: string, viewport = WIDE_VIEWPORT): Promise<Page> {
  return holder.openStory(`parts-cardgrid--${id}`, viewport);
}

/** カードごとの要素・文字・位置と、格子の列の数 */
function readGrid(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector("ul.mdmark-card-grid") as HTMLElement;
    const cards = [...grid.querySelectorAll(":scope > li")].map((li) => {
      const card = li.firstElementChild as HTMLElement;
      const title = card.querySelector(
        ".mdmark-card-grid-title",
      ) as HTMLElement;
      const box = card.getBoundingClientRect();
      return {
        tag: card.tagName,
        className: card.className,
        href: card.getAttribute("href"),
        icon:
          card
            .querySelector(".mdmark-card-grid-icon")
            ?.getAttribute("data-icon") ?? null,
        iconHidden:
          card
            .querySelector(".mdmark-card-grid-icon")
            ?.getAttribute("aria-hidden") ?? null,
        title: title.textContent,
        description:
          card.querySelector(".mdmark-card-grid-desc")?.textContent ?? null,
        underline: getComputedStyle(title).textDecorationLine,
        top: Math.round(box.top),
        left: Math.round(box.left),
        height: Math.round(box.height),
      };
    });
    return { cards, listStyle: getComputedStyle(grid).listStyleType };
  });
}

// リンクのカードを、アイコン・タイトル・説明で入るだけ横に並べる（Wide）
test("test_wide", async () => {
  // 準備・実行
  const page = await open("wide");
  // 検証
  const { cards, listStyle } = await readGrid(page);
  expect(listStyle).toBe("none");
  expect(cards.map((card) => card.tag)).toEqual(["A", "A", "A", "A"]);
  expect(cards.map((card) => card.title)).toEqual([
    "使い方",
    "リファレンス",
    "example.com/docs",
    "始める",
  ]);
  expect(cards.map((card) => card.icon)).toEqual([
    "book",
    null,
    null,
    "rocket",
  ]);
  expect(cards[0]?.iconHidden).toBe("true");
  expect(cards.map((card) => card.description)).toEqual([
    "導入と使い方の手順",
    "名前から引く一覧",
    null,
    null,
  ]);
  for (const card of cards) {
    expect(card.className).toBe("mdmark-card-grid-item");
    expect(card.underline).toBe("underline");
  }
  expect(new Set(cards.map((card) => card.top)).size).toBe(1);
  // Tab で書いた順にリンクのカードへフォーカスが移る
  const focused: string[] = [];
  for (let index = 0; index < cards.length; index++) {
    await page.keyboard.press("Tab");
    focused.push(
      await page.evaluate(
        () =>
          document.activeElement?.querySelector(".mdmark-card-grid-title")
            ?.textContent ?? "",
      ),
    );
  }
  expect(focused).toEqual(cards.map((card) => card.title));
  await page.close();
});

// リンクの無い項目は div のカードにし、タイトルに下線を引かず Tab で止まらない（NoLink）
test("test_no_link", async () => {
  // 準備・実行
  const page = await open("no-link");
  // 検証
  const { cards } = await readGrid(page);
  expect(cards.map((card) => card.tag)).toEqual(["DIV", "A"]);
  expect(cards[0]?.href).toBeNull();
  expect(cards[0]?.icon).toBe("clock");
  expect(cards[0]?.description).toBe("次の版で追加する");
  expect(cards[0]?.underline).toBe("none");
  expect(cards[1]?.underline).toBe("underline");
  await page.keyboard.press("Tab");
  await expect(
    page.evaluate(() => document.activeElement?.tagName ?? ""),
  ).resolves.toBe("A");
  await page.close();
});

// 長いタイトルと説明は折り返し、同じ行のカードの高さを揃える（Long）
test("test_long", async () => {
  // 準備・実行
  const page = await open("long");
  // 検証
  const { cards } = await readGrid(page);
  expect(new Set(cards.map((card) => card.top)).size).toBe(1);
  expect(new Set(cards.map((card) => card.height)).size).toBe(1);
  const lines = await page.evaluate(() => {
    const desc = document.querySelector(
      ".mdmark-card-grid-desc",
    ) as HTMLElement;
    return (
      desc.getBoundingClientRect().height /
      Number.parseFloat(getComputedStyle(desc).lineHeight)
    );
  });
  expect(lines).toBeGreaterThan(1.5);
  await expect(pageOverflows(page)).resolves.toBe(false);
  await page.close();
});

// 描く先の要素が 390px のときは 1 列に積む（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await open("narrow");
  // 検証
  const { cards } = await readGrid(page);
  expect(cards).toHaveLength(4);
  expect(new Set(cards.map((card) => card.left)).size).toBe(1);
  const tops = cards.map((card) => card.top);
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  expect(new Set(tops).size).toBe(4);
  await expect(pageOverflows(page)).resolves.toBe(false);
  await page.close();
});
