import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

// スクリプトが動かないときも番号の上に開く広い画面（狭い画面は描く先の要素の左端から出す）
const WIDE_VIEWPORT = { width: 1280, height: 800 };

// 狭い画面（スマホ）
const NARROW_VIEWPORT = { width: 390, height: 844 };

// 操作できる文字の大きさの下限（px）
const MIN_UI_TEXT_PX = 11;

beforeAll(holder.launch);
afterAll(holder.close);

/** 番号のリンクの文字（視覚で隠す `脚注 ` を含む）と、前後に CSS で付ける角括弧 */
function linkText(page: Page) {
  return page.locator(".mdmark-fn-link").evaluate((element) => ({
    text: element.textContent,
    before: getComputedStyle(element, "::before").content,
    after: getComputedStyle(element, "::after").content,
  }));
}

/** ツールチップと番号のリンクの画面に対する上端・下端と、透明な線の側 */
function tipLayout(page: Page) {
  return page.evaluate(() => {
    const tip = document.querySelector(".mdmark-fn-tip");
    const link = document.querySelector(".mdmark-fn-link");
    if (!tip || !link) {
      throw new Error("ツールチップか番号が無い");
    }
    const t = tip.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    const style = getComputedStyle(tip);
    return {
      tipTop: t.top,
      tipBottom: t.bottom,
      linkTop: l.top,
      linkBottom: l.bottom,
      display: style.display,
      transparentTop: style.borderBlockStartColor === "rgba(0, 0, 0, 0)",
      transparentBottom: style.borderBlockEndColor === "rgba(0, 0, 0, 0)",
    };
  });
}

// 開く前は、番号の色の角括弧付きの上付きの番号だけが出て、ツールチップは隠れている（Closed）
test("test_footnote_ref_closed", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-footnoteref--closed",
    WIDE_VIEWPORT,
  );
  // 検証
  const link = page.locator(".mdmark-fn-link");
  await expect(linkText(page)).resolves.toEqual({
    text: "脚注 1",
    before: '"["',
    after: '"]"',
  });
  const style = await link.evaluate((element) => {
    const computed = getComputedStyle(element);
    const ref = element.closest(".mdmark-fn-ref") as Element;
    return {
      color: computed.color,
      fontSize: Number.parseFloat(getComputedStyle(ref).fontSize),
      verticalAlign: getComputedStyle(ref).verticalAlign,
      decoration: computed.textDecorationLine,
    };
  });
  expect(style.verticalAlign).toBe("super");
  expect(style.decoration).toBe("none");
  expect(style.fontSize).toBeGreaterThanOrEqual(MIN_UI_TEXT_PX);
  await expect(link.getAttribute("aria-describedby")).resolves.toBe(
    "mdmark-fn-tip-1-0",
  );
  expect((await tipLayout(page)).display).toBe("none");
});

// 開いたツールチップは番号の上にあり、タイトル `脚注 1` と中身を持つ role="tooltip"（Open）
test("test_footnote_ref_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-footnoteref--open", WIDE_VIEWPORT);
  // 検証
  const layout = await tipLayout(page);
  expect(layout.display).toBe("block");
  expect(layout.tipBottom).toBeLessThanOrEqual(layout.linkTop);
  expect(layout.transparentBottom).toBe(true);
  const tip = page.locator(".mdmark-fn-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(page.locator(".mdmark-fn-tip-title").innerText()).resolves.toBe(
    "脚注 1",
  );
  await expect(page.locator(".mdmark-fn-tip-body").innerText()).resolves.toBe(
    "CSS 変数と層の外の CSS で上書きする。",
  );
});

// 下に開いたツールチップは番号の下にあり、透明な線が上側にある（Below）
test("test_footnote_ref_below", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-footnoteref--below",
    WIDE_VIEWPORT,
  );
  // 検証
  const layout = await tipLayout(page);
  expect(layout.tipTop).toBeGreaterThanOrEqual(layout.linkBottom);
  expect(layout.transparentTop).toBe(true);
  expect(layout.transparentBottom).toBe(false);
});

// 中身がリンクを持つと role="group" で、番号が aria-details で指し、中のリンクへ Tab で移れる（WithLink）
test("test_footnote_ref_with_link", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-footnoteref--with-link",
    WIDE_VIEWPORT,
  );
  // 検証
  const tip = page.locator(".mdmark-fn-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("group");
  await expect(tip.getAttribute("aria-label")).resolves.toBe("脚注 1");
  const link = page.locator(".mdmark-fn-link");
  await expect(link.getAttribute("aria-details")).resolves.toBe(
    "mdmark-fn-tip-1-0",
  );
  await expect(link.getAttribute("aria-describedby")).resolves.toBeNull();
  await link.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.evaluate(() => document.activeElement?.textContent),
  ).resolves.toBe("テーマを選ぶ");
});

// 2 段落の中身を段落ごとに積み、幅の上限で折り返す。狭い画面でも横スクロールが出ない（Long）
test("test_footnote_ref_long", async () => {
  // 準備・実行
  for (const viewport of [WIDE_VIEWPORT, NARROW_VIEWPORT]) {
    const page = await holder.openStory("parts-footnoteref--long", viewport);
    // 検証
    const bodies = page.locator(".mdmark-fn-tip-body");
    await expect(bodies.count()).resolves.toBe(2);
    const layout = await page.evaluate(() => {
      const [first, second] = [
        ...document.querySelectorAll(".mdmark-fn-tip-body"),
      ].map((body) => body.getBoundingClientRect());
      const tip = document
        .querySelector(".mdmark-fn-tip")
        ?.getBoundingClientRect();
      return {
        stacked: (second?.top ?? 0) >= (first?.bottom ?? 0),
        tipRight: tip?.right ?? 0,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(layout.stacked).toBe(true);
    expect(layout.tipRight).toBeLessThanOrEqual(layout.viewportWidth);
    await expect(pageOverflows(page)).resolves.toBe(false);
  }
});

// 2 桁の番号と 2 回目の参照の id を持つ（TwoDigits）
test("test_footnote_ref_two_digits", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-footnoteref--two-digits",
    WIDE_VIEWPORT,
  );
  // 検証
  const link = page.locator(".mdmark-fn-link");
  await expect(linkText(page)).resolves.toMatchObject({ text: "脚注 12" });
  await expect(link.getAttribute("id")).resolves.toBe("mdmark-fnref-12-1");
  await expect(page.locator(".mdmark-fn-tip-title").innerText()).resolves.toBe(
    "脚注 12",
  );
});

// 描いた直後の一覧は閉じていて、見出し `脚注（2 件）` だけが出る（Closed）
test("test_footnotes_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-footnotes--closed", WIDE_VIEWPORT);
  // 検証
  const details = page.locator("details.mdmark-footnotes");
  await expect(details.getAttribute("open")).resolves.toBeNull();
  await expect(page.locator("summary").innerText()).resolves.toBe(
    "脚注（2 件）",
  );
  await expect(
    page.locator(".mdmark-fn-item").first().isVisible(),
  ).resolves.toBe(false);
});

// 開いた一覧は、角括弧付きの番号と中身と末尾の戻るリンクを並べる（Open）
test("test_footnotes_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-footnotes--open", WIDE_VIEWPORT);
  // 検証
  const items = await page.locator(".mdmark-fn-item").evaluateAll((elements) =>
    elements.map((element) => ({
      id: element.id,
      number: getComputedStyle(element, "::before").content,
      back: element
        .querySelector(".mdmark-fn-back")
        ?.getAttribute("aria-label"),
    })),
  );
  expect(items).toEqual([
    {
      id: "mdmark-fn-1",
      number: '"[" counter(mdmark-fn) "]"',
      back: "本文の脚注 1 へ戻る",
    },
    {
      id: "mdmark-fn-2",
      number: '"[" counter(mdmark-fn) "]"',
      back: "本文の脚注 2 へ戻る",
    },
  ]);
  await expect(
    page.locator(".mdmark-fn-item").first().innerText(),
  ).resolves.toContain("CSS 変数と層の外の CSS で上書きする。");
});

// 2 回参照した脚注は、項目 1 つに a・b の戻るリンクを並べる（ReferencedTwice）
test("test_footnotes_referenced_twice", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-footnotes--referenced-twice",
    WIDE_VIEWPORT,
  );
  // 検証
  await expect(page.locator(".mdmark-fn-item").count()).resolves.toBe(1);
  const backs = await page.locator(".mdmark-fn-back").evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href"),
      text: element.textContent,
    })),
  );
  expect(backs).toEqual([
    { href: "#mdmark-fnref-1-0", text: "a" },
    { href: "#mdmark-fnref-1-1", text: "b" },
  ]);
});

// 2 段落とリンクを持つ中身でも、狭い画面で横スクロールが出ない（Long）
test("test_footnotes_long", async () => {
  // 準備・実行
  for (const viewport of [WIDE_VIEWPORT, NARROW_VIEWPORT]) {
    const page = await holder.openStory("parts-footnotes--long", viewport);
    // 検証
    const first = page.locator(".mdmark-fn-item").first();
    await expect(first.locator("p").count()).resolves.toBe(2);
    // 戻るリンクは最後の段落の末尾に置く
    await expect(
      first.locator("p").last().locator(".mdmark-fn-back").count(),
    ).resolves.toBe(1);
    await expect(pageOverflows(page)).resolves.toBe(false);
  }
});
