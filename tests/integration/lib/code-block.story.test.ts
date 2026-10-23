import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 題と行番号を出し、2 行目だけを強調の地と左の線で分ける（TitleAndLineNumbers）
test("test_title_and_line_numbers", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-codeblock--title-and-line-numbers",
  );
  // 検証
  await expect(page.locator(".mdmark-code-title").innerText()).resolves.toBe(
    "app.ts",
  );
  const lines = page.locator(".mdmark-code-line");
  await expect(lines.count()).resolves.toBe(3);
  const numbers = await lines.evaluateAll((elements) =>
    elements.map((element) => ({
      line: element.getAttribute("data-line"),
      content: getComputedStyle(element, "::before").content,
      background: getComputedStyle(element).backgroundColor,
      borderColor: getComputedStyle(element).borderInlineStartColor,
    })),
  );
  expect(numbers.map((item) => item.line)).toEqual(["1", "2", "3"]);
  expect(numbers[0]?.content).toContain("1");
  expect(numbers[1]?.background).not.toBe(numbers[0]?.background);
  expect(numbers[1]?.borderColor).not.toBe(numbers[0]?.borderColor);
  // 行番号は文字を選んで写す中身に入らない
  const copied = await page.locator("#storybook-root pre").evaluate((pre) => {
    const selection = window.getSelection();
    selection?.selectAllChildren(pre);
    return selection?.toString() ?? "";
  });
  expect(copied).not.toMatch(/^\d/m);
  expect(copied).toContain("import { mount }");
});

// 足した行・消した行・強調を色と行頭の印で分け、印の無い行も文字の頭を揃える（LineMarks）
test("test_line_marks", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--line-marks");
  // 検証
  const marks = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        kind: element.getAttribute("data-kind"),
        sign: getComputedStyle(element, "::after").content,
        background: getComputedStyle(element).backgroundColor,
        textLeft: element
          .querySelector(".mdmark-code-text")
          ?.getBoundingClientRect().left,
      })),
    );
  expect(marks.map((item) => item.kind)).toEqual([
    "del",
    "add",
    "highlight",
    null,
  ]);
  expect(marks[0]?.sign).toContain("-");
  expect(marks[1]?.sign).toContain("+");
  expect(new Set(marks.map((item) => item.background)).size).toBe(4);
  expect(new Set(marks.map((item) => item.textLeft)).size).toBe(1);
  await expect(page.locator(".mdmark-code-title").count()).resolves.toBe(0);
});

// 題だけなら行に分けず、今の pre のまま題の帯の下に置く（TitleOnly）
test("test_title_only", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--title-only");
  // 検証
  await expect(page.locator(".mdmark-code-title").innerText()).resolves.toBe(
    "mdmark.config.yaml",
  );
  await expect(page.locator(".mdmark-code-line").count()).resolves.toBe(0);
  await expect(
    page.locator("#storybook-root figure > pre").getAttribute("class"),
  ).resolves.toBe(null);
  await expect(
    page.locator("#storybook-root pre").getAttribute("aria-label"),
  ).resolves.toBe("コード: mdmark.config.yaml");
});

// 2 桁の行番号を揃え、空の行も 1 行の高さを取り、9〜10 行目を強調する（TwoDigits）
test("test_two_digits", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--two-digits");
  // 検証
  const lines = page.locator(".mdmark-code-line");
  await expect(lines.count()).resolves.toBe(13);
  await expect(
    page.locator("#storybook-root pre code").getAttribute("style"),
  ).resolves.toContain("--mdmark-code-digits: 2");
  const layout = await lines.evaluateAll((elements) =>
    elements.map((element) => ({
      kind: element.getAttribute("data-kind"),
      height: element.getBoundingClientRect().height,
      numberRight:
        element.getBoundingClientRect().left +
        Number.parseFloat(getComputedStyle(element, "::before").left) +
        Number.parseFloat(getComputedStyle(element, "::before").width),
    })),
  );
  expect(
    layout.flatMap((item, index) =>
      item.kind === "highlight" ? [index + 1] : [],
    ),
  ).toEqual([9, 10]);
  const emptyHeight = layout[1]?.height ?? 0;
  expect(emptyHeight).toBeGreaterThan(10);
  expect(emptyHeight).toBeCloseTo(layout[0]?.height ?? 0, 0);
  expect(new Set(layout.map((item) => Math.round(item.numberRight))).size).toBe(
    1,
  );
});

// 幅を超える題は帯の中で折り返し、行はブロックの中で横にスクロールして行の地を右端まで敷く（LongLineAndTitle）
test("test_long_line_and_title", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-codeblock--long-line-and-title");
  // 検証
  const title = await page
    .locator(".mdmark-code-title")
    .evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      fits: element.scrollWidth <= element.clientWidth,
    }));
  expect(title.height).toBeGreaterThan(title.lineHeight * 2);
  expect(title.fits).toBe(true);
  const scroll = await page
    .locator("#storybook-root pre")
    .evaluate((element) => ({
      scrolls: element.scrollWidth > element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
  expect(scroll.scrolls).toBe(true);
  expect(scroll.overflowX).toBe("auto");
  const widths = await page
    .locator(".mdmark-code-line")
    .evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().width),
      ),
    );
  expect(new Set(widths).size).toBe(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
