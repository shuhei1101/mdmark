import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeLucide,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

/** 正常シナリオの 4 項目を囲んだ cards の範囲 */
const CARDS_MARKDOWN = [
  "<!-- cards -->",
  "- `icon:book` [使い方](使い方/README.md)",
  "  導入と使い方の手順",
  "- [リファレンス](リファレンス/README.md) 名前から引く一覧",
  "- https://example.com/docs",
  "- `icon:rocket` [始める](はじめに/README.md)",
  "<!-- /cards -->",
  "",
].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** `example.com` への要求を数える */
function countExampleRequests(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "example.com") {
      count += 1;
    }
  });
  return () => count;
}

/** カードごとの要素・文字・位置 */
function readCards(page: Page) {
  return page.locator("#doc ul.mdmark-card-grid").evaluate((grid) =>
    [...grid.querySelectorAll(":scope > li")].map((li) => {
      const card = li.firstElementChild as HTMLElement;
      const box = card.getBoundingClientRect();
      return {
        tag: card.tagName,
        className: card.className,
        href: card.getAttribute("href"),
        icon:
          card
            .querySelector(".mdmark-card-grid-icon")
            ?.getAttribute("data-icon") ?? null,
        title:
          card.querySelector(".mdmark-card-grid-title")?.textContent ?? null,
        description:
          card.querySelector(".mdmark-card-grid-desc")?.textContent ?? null,
        left: Math.round(box.left),
        top: Math.round(box.top),
        width: Math.round(box.width),
      };
    }),
  );
}

/** Tab を押すたびにフォーカスが移ったカードのタイトル */
async function tabTitles(page: Page, count: number): Promise<string[]> {
  const titles: string[] = [];
  for (let index = 0; index < count; index++) {
    await page.keyboard.press("Tab");
    titles.push(
      await page.evaluate(
        () =>
          document.activeElement?.querySelector(".mdmark-card-grid-title")
            ?.textContent ?? "",
      ),
    );
  }
  return titles;
}

// 囲んだリストの項目を、アイコン・タイトル・説明のカードにして格子に並べる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await routeLucide(page);
  const exampleRequests = countExampleRequests(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: CARDS_MARKDOWN });
  // 検証
  const cards = await readCards(page);
  expect(cards).toHaveLength(4);
  expect(new Set(cards.map((card) => card.top)).size).toBe(1);
  expect(new Set(cards.map((card) => card.width)).size).toBe(1);
  expect(cards[0]).toMatchObject({
    icon: "book",
    title: "使い方",
    description: "導入と使い方の手順",
  });
  expect(cards[1]).toMatchObject({
    icon: null,
    title: "リファレンス",
    description: "名前から引く一覧",
  });
  expect(cards[2]?.title).toBe("example.com/docs");
  expect(cards.map((card) => card.tag)).toEqual(["A", "A", "A", "A"]);
  expect(cards.map((card) => decodeURI(card.href ?? ""))).toEqual([
    "使い方/README.md",
    "リファレンス/README.md",
    "https://example.com/docs",
    "はじめに/README.md",
  ]);
  for (const card of cards) {
    expect(card.className).toBe("mdmark-card-grid-item");
  }
  await expect(page.locator("#doc .mdmark-card")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-view-cards")).toHaveCount(0);
  await expect(page.locator("#doc")).not.toContainText("cards");
  expect(await tabTitles(page, 4)).toEqual([
    "使い方",
    "リファレンス",
    "example.com/docs",
    "始める",
  ]);
  expect(exampleRequests()).toBe(0);
});

// 狭い画面では、カードを記載した順に 1 列に追加する（正常シナリオ（狭い画面））
test("test_normal_when_narrow", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  await routeLucide(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: CARDS_MARKDOWN });
  // 検証
  const cards = await readCards(page);
  expect(cards).toHaveLength(4);
  expect(new Set(cards.map((card) => card.left)).size).toBe(1);
  const tops = cards.map((card) => card.top);
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  expect(new Set(tops).size).toBe(4);
  const gridWidth = await page
    .locator("#doc ul.mdmark-card-grid")
    .evaluate((grid) => Math.round(grid.getBoundingClientRect().width));
  for (const card of cards) {
    expect(card.width).toBe(gridWidth);
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

// リンクを持たない項目は、リンクではなく Tab で止まらないカードにする（正常シナリオ（リンクを持たない項目））
test("test_normal_when_item_without_link", async ({ page }) => {
  // 準備
  await routeLucide(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- cards -->",
      "- `icon:clock` 準備中",
      "  次の版で追加する",
      "- [使い方](使い方/README.md)",
      "<!-- /cards -->",
      "",
    ].join("\n"),
  });
  // 検証
  const cards = await readCards(page);
  expect(cards[0]).toMatchObject({
    tag: "DIV",
    href: null,
    icon: "clock",
    title: "準備中",
    description: "次の版で追加する",
  });
  expect(cards[1]?.tag).toBe("A");
  expect(await tabTitles(page, 1)).toEqual(["使い方"]);
});

// 機能を解除した文書は、囲んだリストをリストのまま描く（正常シナリオ（機能を解除する））
test("test_normal_when_disabled", async ({ page }) => {
  // 準備
  await routeLucide(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `<!-- features: -card-grid -->\n\n${CARDS_MARKDOWN}`,
  });
  // 検証
  await expect(page.locator("#doc .mdmark-card-grid")).toHaveCount(0);
  const items = page.locator("#doc ul > li");
  await expect(items).toHaveCount(4);
  await expect(items.nth(2).locator("a.mdmark-card")).toHaveCount(1);
  await expect(page.locator("#doc")).not.toContainText("cards");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// 範囲の中身がリスト 1 つでないときは、記載の警告を配置して記載したとおりに描く（異常シナリオ（リスト以外の中身））
test("test_error_when_not_list", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- cards -->",
      "",
      "囲んだ段落",
      "",
      "- [使い方](a.md)",
      "- [参照](b.md)",
      "<!-- /cards -->",
      "",
    ].join("\n"),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("<!-- cards -->");
  await expect(warning).toContainText("リスト 1 つ");
  await expect(page.locator("#doc .mdmark-card-grid")).toHaveCount(0);
  const order = await page
    .locator("#doc")
    .evaluate((el) =>
      [...el.querySelectorAll(".mdmark-syntax-warning, p, ul")].map((node) =>
        node.classList.contains("mdmark-syntax-warning")
          ? "warning"
          : node.tagName === "UL"
            ? "list"
            : (node.textContent ?? ""),
      ),
    );
  expect(order.indexOf("warning")).toBeLessThan(order.indexOf("囲んだ段落"));
  expect(order.indexOf("囲んだ段落")).toBeLessThan(order.indexOf("list"));
  await expect(page.locator("#doc ul > li")).toHaveCount(2);
});
