import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import { contrastRatio, resolveColor } from "../media.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 面を持たない要素の背景の色
const TRANSPARENT = "rgba(0, 0, 0, 0)";

// 金額の列を強調し、状態で行に色を付けた表と、色の名前のバッジと本文の文字の色を持つ文書
const MARKDOWN = [
  "<!-- table: data highlight=金額 row-color=状態:完了=green,保留=yellow -->",
  "",
  "| 名前 | 状態 | 金額 |",
  "| --- | --- | --- |",
  "| 見積もり | 完了 | 120 |",
  "| 契約 | 保留 | 80 |",
  "| 請求 | 未着手 | 45 |",
  "",
  "<!-- /table -->",
  "",
  "確認は `badge:red:要確認` で、[決め手の 1 文]{color=blue} を読む。",
  "",
].join("\n");

/** 色のプリセットの面と文字の色（`var(--mdmark-color-accent-{色}-bg)`・`-text`）を、描いた文書の中で解決する */
async function preset(
  page: Page,
  color: string,
): Promise<{ bg: string; text: string }> {
  return {
    bg: await resolveColor(
      page,
      "#doc",
      `var(--mdmark-color-accent-${color}-bg)`,
    ),
    text: await resolveColor(
      page,
      "#doc",
      `var(--mdmark-color-accent-${color}-text)`,
    ),
  };
}

/** 表の本文の行ごとの名前・行の色の名前・セルの面と文字の色・下の罫線の色・上の線（box-shadow） */
async function readRows(page: Page) {
  return page.locator("#doc table tbody tr").evaluateAll((rows) =>
    rows.map((row) => {
      const cells = [...row.querySelectorAll("td")];
      const style = (cell: Element) => getComputedStyle(cell);
      return {
        name: cells[0]?.textContent ?? "",
        color: row.getAttribute("data-color"),
        backgrounds: cells.map((cell) => style(cell).backgroundColor),
        texts: cells.map((cell) => style(cell).color),
        borderBottom: cells.map((cell) => style(cell).borderBottomColor),
        boxShadow: cells.map((cell) => style(cell).boxShadow),
      };
    }),
  );
}

/** 金額の列（3 列目）の見出しのセルの面の色と下端の線（box-shadow） */
async function readHighlightHead(page: Page) {
  return page
    .locator("#doc table thead th")
    .nth(2)
    .evaluate((cell) => ({
      highlighted: cell.classList.contains("mdmark-col-highlight"),
      background: getComputedStyle(cell).backgroundColor,
      color: getComputedStyle(cell).color,
      boxShadow: getComputedStyle(cell).boxShadow,
    }));
}

/** バッジと本文の文字の色の要素の、文言・文字と面の色 */
async function readInline(page: Page) {
  return page.locator("#doc").evaluate((doc) => {
    const badge = doc.querySelector(".mdmark-badge[data-color]") as Element;
    const text = doc.querySelector(".mdmark-color[data-color]") as Element;
    return {
      badgeLabel: badge.textContent,
      badgeColor: badge.getAttribute("data-color"),
      badgeText: getComputedStyle(badge).color,
      badgeBg: getComputedStyle(badge).backgroundColor,
      textLabel: text.textContent,
      textColor: text.getAttribute("data-color"),
      text: getComputedStyle(text).color,
      paragraph: text.closest("p")?.textContent ?? "",
    };
  });
}

/** 列・行・バッジ・本文の色が色のプリセットの値で、色を付けた文字と面のコントラストが 4.5:1 以上であることを確かめる */
async function expectColored(page: Page): Promise<void> {
  const [blue, green, yellow, red] = await Promise.all(
    ["blue", "green", "yellow", "red"].map((color) => preset(page, color)),
  );
  const background = await resolveColor(page, "#doc", "var(--mdmark-color-bg)");
  const rows = await readRows(page);
  // 完了は green、保留は yellow の面で、未着手は色を持たない
  const done = rows.find((row) => row.name === "見積もり");
  const hold = rows.find((row) => row.name === "契約");
  const todo = rows.find((row) => row.name === "請求");
  expect(done?.color).toBe("green");
  expect(done?.backgrounds).toEqual([green?.bg, green?.bg, green?.bg]);
  expect(done?.borderBottom).toEqual([green?.text, green?.text, green?.text]);
  expect(hold?.color).toBe("yellow");
  expect(hold?.backgrounds).toEqual([yellow?.bg, yellow?.bg, yellow?.bg]);
  expect(hold?.borderBottom).toEqual([
    yellow?.text,
    yellow?.text,
    yellow?.text,
  ]);
  expect(todo?.color).toBeNull();
  for (const color of [green, yellow]) {
    expect(todo?.backgrounds.slice(0, 2)).not.toContain(color?.bg);
    expect(todo?.borderBottom).not.toContain(color?.text);
  }
  expect(todo?.boxShadow.slice(0, 2)).toEqual(["none", "none"]);
  // 未着手の行の金額の列のセルは、強調の面（blue）
  expect(todo?.backgrounds[2]).toBe(blue?.bg);
  // 色を付けた行の連なりの先頭に、上の線がある
  const first = rows.find((row) => row.color !== null);
  for (const shadow of first?.boxShadow ?? []) {
    expect(shadow).toContain("inset");
  }
  // 金額の列の見出しは、強調の面と下端の線
  const head = await readHighlightHead(page);
  expect(head.highlighted).toBe(true);
  expect(head.background).toBe(blue?.bg);
  expect(head.boxShadow).toContain(blue?.text);
  expect(contrastRatio(head.color, head.background)).toBeGreaterThanOrEqual(
    4.5,
  );
  // セルの文字と面のコントラスト（面を持たないセルは文書の地の色）
  for (const row of rows) {
    row.texts.forEach((text, index) => {
      const cell = row.backgrounds[index] ?? TRANSPARENT;
      expect(
        contrastRatio(text, cell === TRANSPARENT ? background : cell),
        `${row.name} の ${index + 1} 列目`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
  // バッジと本文の文字
  const inline = await readInline(page);
  expect(inline.badgeLabel).toBe("要確認");
  expect(inline.badgeColor).toBe("red");
  expect(inline.badgeText).toBe(red?.text);
  expect(
    contrastRatio(inline.badgeText, inline.badgeBg),
  ).toBeGreaterThanOrEqual(4.5);
  expect(inline.textLabel).toBe("決め手の 1 文");
  expect(inline.textColor).toBe("blue");
  expect(inline.text).toBe(blue?.text);
  expect(contrastRatio(inline.text, background)).toBeGreaterThanOrEqual(4.5);
  expect(inline.paragraph).not.toContain("red:");
  expect(inline.paragraph).not.toContain("{color=blue}");
  expect(inline.paragraph).not.toContain("[決め手");
}

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 列・行・バッジ・本文の文字を色のプリセットで描き、並べ替えても行の色が行に付いたまま動く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  await expectColored(page);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
  // 実行: 金額の列の見出しで並べ替える（降順）
  const amount = page.locator("#doc table thead th").nth(2);
  await amount.locator("button.mdmark-sort").click();
  await expect(amount).toHaveAttribute("aria-sort", "descending");
  // 検証: 行の並びが変わり、色と線がその行に付いたまま
  const sorted = await readRows(page);
  expect(sorted.map((row) => row.name)).toEqual(["見積もり", "契約", "請求"]);
  expect(sorted.map((row) => row.color)).toEqual(["green", "yellow", null]);
  await expectColored(page);
});

// OS の配色がダークのとき、ダークの色のプリセットで描く（正常シナリオ（ダークの配色））
test("test_normal_when_dark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: MARKDOWN });
  const light = await preset(page, "green");
  // 実行
  await page.emulateMedia({ colorScheme: "dark" });
  // 検証: 色のプリセットがダークの値に替わり、列・行・バッジ・本文がその値で描かれる
  const dark = await preset(page, "green");
  expect(dark.bg).not.toBe(light.bg);
  expect(dark.text).not.toBe(light.text);
  await expectColored(page);
});

// 行の位置で指定した 2 行目にだけ色と線を付ける（正常シナリオ（行の位置で色を付ける））
test("test_normal_when_row_position", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data row-at=2=yellow -->",
      "",
      "| 名前 | 数 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "| c | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  // 検証
  const yellow = await preset(page, "yellow");
  const rows = await readRows(page);
  expect(rows.map((row) => row.color)).toEqual([null, "yellow", null]);
  expect(rows[1]?.backgrounds).toEqual([yellow.bg, yellow.bg]);
  expect(rows[1]?.borderBottom).toEqual([yellow.text, yellow.text]);
  for (const shadow of rows[1]?.boxShadow ?? []) {
    expect(shadow).toContain("inset");
  }
  for (const row of [rows[0], rows[2]]) {
    expect(row?.backgrounds).not.toContain(yellow.bg);
    expect(row?.borderBottom).not.toContain(yellow.text);
    expect(row?.boxShadow).toEqual(["none", "none"]);
  }
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// 最初の : の前が色の名前でないバッジは、全てを文言にして色の無いバッジと同じ見た目で描く（正常シナリオ（色の名前でない頭のバッジ））
test("test_normal_when_badge_prefix_not_color", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "版は `badge:v1:beta` と `badge:stable` を見る。\n",
  });
  // 検証
  const badges = page.locator("#doc .mdmark-badge");
  await expect(badges).toHaveText(["v1:beta", "stable"]);
  await expect(badges.first()).not.toHaveAttribute("data-color", /.*/);
  const [prefixed, plain] = await badges.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundColor, style.borderTopColor];
    }),
  );
  expect(prefixed).toEqual(plain);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// 知らない色の名前は、表と本文の段落の上に書き方の警告を出し、色を付けずに描く（異常シナリオ（知らない色の名前））
test("test_error_when_color_unknown", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data row-color=状態:完了=pink -->",
      "",
      "| 名前 | 状態 |",
      "| --- | --- |",
      "| 見積もり | 完了 |",
      "",
      "<!-- /table -->",
      "",
      "[決め手の 1 文]{color=pink}",
      "",
    ].join("\n"),
  });
  // 検証: 表の上と段落の上に警告
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(2);
  for (const index of [0, 1]) {
    const warning = warnings.nth(index);
    await expect(warning).toContainText("pink");
    for (const name of ["blue", "red", "green", "yellow", "orange"]) {
      await expect(warning).toContainText(name);
    }
  }
  const order = await page.locator("#doc").evaluate((doc) => {
    const top = (element: Element | null) =>
      element?.getBoundingClientRect().top ?? Number.NaN;
    const boxes = [...doc.querySelectorAll(".mdmark-syntax-warning")];
    return {
      tableWarning: top(boxes[0] ?? null),
      table: top(doc.querySelector("table")),
      paragraphWarning: top(boxes[1] ?? null),
      paragraph: top(
        [...doc.querySelectorAll("p")].find(
          (paragraph) =>
            !paragraph.closest(".mdmark-syntax-warning") &&
            paragraph.textContent?.includes("決め手"),
        ) ?? null,
      ),
    };
  });
  expect(order.tableWarning).toBeLessThan(order.table);
  expect(order.table).toBeLessThan(order.paragraphWarning);
  expect(order.paragraphWarning).toBeLessThan(order.paragraph);
  // 色を付けない
  await expect(page.locator("#doc tr[data-color]")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-color")).toHaveCount(0);
  const paragraph = page.locator("#doc p", { hasText: "決め手の 1 文" });
  await expect(paragraph).toHaveText("決め手の 1 文");
  expect(
    await paragraph.evaluate((element) => getComputedStyle(element).color),
  ).toBe(await resolveColor(page, "#doc", "var(--mdmark-color-text)"));
});
