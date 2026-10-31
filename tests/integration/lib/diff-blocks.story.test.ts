import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows, resolveColor } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 色を当てたブロックの要素（本文のブロックは `div`、項目は `li`、行は `tr`） */
const BLOCK = ".mdmark-diff-block";

/** 色を当てたブロックの背景色の計算値と、種類ごとの地の色の変数の値 */
async function backgrounds(
  page: Page,
  kind: "add" | "del",
): Promise<{ actual: string; expected: string }> {
  const actual = await page
    .locator(BLOCK)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const expected = await resolveColor(
    page,
    `var(--mdmark-color-diff-${kind}-bg)`,
  );
  return { actual, expected };
}

/** 色を当てたブロックの先頭の、読み上げにだけ出す名前と記号 */
async function marks(page: Page): Promise<{ name: string; sign: string }> {
  return {
    name: await page.locator(`${BLOCK} .mdmark-visually-hidden`).innerText(),
    sign: await page
      .locator(`${BLOCK} [aria-hidden="true"]`)
      .first()
      .innerText(),
  };
}

// 語を書き換えた段落と足した段落は、追加の地の色と左の余白の + で出し、読み上げの名前を持つ（AddParagraph）
test("test_add_paragraph", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--add-paragraph");
  // 検証
  const block = page.locator(`div${BLOCK}`);
  await expect(block.getAttribute("data-kind")).resolves.toBe("add");
  await expect(marks(page)).resolves.toEqual({ name: "追加:", sign: "+" });
  const { actual, expected } = await backgrounds(page, "add");
  expect(actual).toBe(expected);
  const sign = page.locator(`${BLOCK} .mdmark-diff-block-sign`);
  await expect(sign.getAttribute("aria-hidden")).resolves.toBe("true");
  const color = await sign.evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe(
    await resolveColor(page, "var(--mdmark-color-diff-add-sign)"),
  );
  // 変えていない段落と文字の位置が揃う
  const lefts = await page.evaluate(() =>
    [...document.querySelectorAll("#storybook-root p")].map((p) =>
      Math.round(p.getBoundingClientRect().left),
    ),
  );
  expect(new Set(lefts).size).toBe(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 削除した段落は、削除の地の色と左の余白の − で出し、行番号を持たない（DelParagraph）
test("test_del_paragraph", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--del-paragraph");
  // 検証
  await expect(
    page.locator(`div${BLOCK}`).getAttribute("data-kind"),
  ).resolves.toBe("del");
  await expect(marks(page)).resolves.toEqual({ name: "削除:", sign: "−" });
  const { actual, expected } = await backgrounds(page, "del");
  expect(actual).toBe(expected);
  await expect(
    page.locator(`${BLOCK} [data-source-line]`).count(),
  ).resolves.toBe(0);
});

// 足した見出しは、見出しの文字の大きさのまま追加の色を当てる（AddHeading）
test("test_add_heading", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--add-heading");
  // 検証
  await expect(marks(page)).resolves.toEqual({ name: "追加:", sign: "+" });
  const { actual, expected } = await backgrounds(page, "add");
  expect(actual).toBe(expected);
  const sizes = await page.evaluate(() => ({
    heading: Number.parseFloat(
      getComputedStyle(document.querySelector("#storybook-root h2") as Element)
        .fontSize,
    ),
    paragraph: Number.parseFloat(
      getComputedStyle(document.querySelector("#storybook-root p") as Element)
        .fontSize,
    ),
  }));
  expect(sizes.heading).toBeGreaterThan(sizes.paragraph);
});

// 表の削除した行は、tr に class を付け、1 つ目のセルの先頭に読み上げの `削除:` と − を置く（TableRowDel）
test("test_table_row_del", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--table-row-del");
  // 検証
  const row = page.locator(`tr${BLOCK}`);
  await expect(row.getAttribute("data-kind")).resolves.toBe("del");
  await expect(page.locator(`div${BLOCK}`).count()).resolves.toBe(0);
  const first = row.locator("td").first();
  await expect(
    first.locator(".mdmark-visually-hidden").innerText(),
  ).resolves.toBe("削除:");
  await expect(first.locator('[aria-hidden="true"]').innerText()).resolves.toBe(
    "−",
  );
  const { actual, expected } = await backgrounds(page, "del");
  expect(actual).toBe(expected);
});

// 番号付きリストの削除した項目は、番号を出さず、後ろの項目の番号を進めない（ListItemDel）
test("test_list_item_del", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--list-item-del");
  // 検証
  const item = page.locator(`li${BLOCK}`);
  await expect(item.getAttribute("data-kind")).resolves.toBe("del");
  const style = await item.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      listStyleType: computed.listStyleType,
      counterIncrement: computed.counterIncrement,
    };
  });
  expect(style).toEqual({
    listStyleType: "none",
    counterIncrement: "list-item 0",
  });
  // 色を当てていない項目は、番号を出して数える
  const others = await page.evaluate(() =>
    [...document.querySelectorAll("li:not(.mdmark-diff-block)")].map((li) => {
      const computed = getComputedStyle(li);
      return [computed.listStyleType, computed.counterIncrement];
    }),
  );
  for (const [listStyleType, counterIncrement] of others) {
    expect(listStyleType).not.toBe("none");
    expect(counterIncrement).not.toBe("list-item 0");
  }
});

// 足したコードブロックは、コードブロックの地の色を変えず、外側に追加の色を当てる（CodeBlock）
test("test_code_block", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--code-block");
  // 検証
  const { actual, expected } = await backgrounds(page, "add");
  expect(actual).toBe(expected);
  const code = await page
    .locator(`${BLOCK} pre`)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(code).not.toBe(expected);
});

// 削除した注意書きは、注意書きの色を変えず、外側に削除の色を当てる（Callout）
test("test_callout", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--callout");
  // 検証
  const { actual, expected } = await backgrounds(page, "del");
  expect(actual).toBe(expected);
  await expect(page.locator(`${BLOCK} .mdmark-callout`).count()).resolves.toBe(
    1,
  );
  const inner = await page
    .locator(`${BLOCK} .mdmark-callout`)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(inner).not.toBe(expected);
});

// 長い URL を持つ追加の段落は、ブロックの中で折り返し、横スクロールを出さない（LongUrl）
test("test_long_url", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffblocks--long-url");
  // 検証
  await expect(pageOverflows(page)).resolves.toBe(false);
  const fits = await page
    .locator(`div${BLOCK}`)
    .evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fits).toBe(true);
});
