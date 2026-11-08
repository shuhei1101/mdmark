import { expect, type Locator, type Page, test } from "@playwright/test";
import { DIFF_DOC_ID, DIFF_REVISIONS } from "../diff-samples.ts";
import { toggleOf, waitForDiff } from "../diff-ui.ts";
import {
  buildDistRoot,
  installCommentStore,
  mountDiffDocument,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import { colorSvg, routePageFiles } from "../media.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

/** 長い Markdown の見出し（`## 導入` から `## 付録` までの 10 個） */
const HEADINGS = [
  "導入",
  "前提",
  "準備",
  "設定",
  "使い方",
  "応用",
  "運用",
  "確認",
  "参考",
  "付録",
];

/** 見出しごとの段落の数（文書を画面の高さの 3 倍より長くする） */
const PARAGRAPHS = 10;

/** 10 個の見出しと、画面の高さの 3 倍を超える段落を持つ文書 */
const LONG_MARKDOWN = HEADINGS.flatMap((heading) => [
  `## ${heading}`,
  "",
  ...Array.from({ length: PARAGRAPHS }, (_, i) => [
    `${heading}の段落 ${i + 1} は、画面の高さの 3 倍を超えるまで並べる本文。`,
    "",
  ]).flat(),
]).join("\n");

/** 押せる大きさの下限（px） */
const MIN_SIZE_PX = 44;

/** ボタンへ Tab で移るまでに押す回数の上限 */
const MAX_TABS = 100;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

/** 先頭へ戻るボタン */
function backToTop(page: Page): Locator {
  return page.getByRole("button", { name: "先頭へ戻る" });
}

/** 描いた文書の見出し */
function heading(page: Page, name: string): Locator {
  return page.locator(`#doc h2[id="${name}"]`);
}

/** 画面全体を末尾までスクロールする */
async function scrollToEnd(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
}

/** 要素の矩形を返却する（無ければ例外） */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("要素の矩形が取れない");
  }
  return box;
}

/** 2 つの矩形が重なるか */
function overlaps(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

/** Tab を押してボタンへフォーカスを移す */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let count = 0; count < MAX_TABS; count += 1) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }
  throw new Error("Tab でボタンへ届かない");
}

/** 長い文書を描いたページを開く */
async function openLongDocument(
  page: Page,
  markdown: string = LONG_MARKDOWN,
): Promise<void> {
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown });
}

// 末尾までスクロールすると右下に先頭へ戻るボタンが出て、押すと文書の先頭へ戻り、フォーカスが文書の先頭へ移る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openLongDocument(page);
  const button = backToTop(page);
  // 実行: 文書の末尾までスクロールする
  await scrollToEnd(page);
  // 検証
  await expect(button).toBeVisible();
  const box = await boxOf(button);
  expect(box.x + box.width).toBeGreaterThan(1280 / 2);
  expect(box.y + box.height).toBeGreaterThan(800 / 2);
  // 実行: ボタンを押す
  await button.click();
  // 検証
  await expect(heading(page, "導入")).toBeInViewport();
  await expect(page.locator("#doc > .mdmark-content")).toBeFocused();
  await expect(button).toBeHidden();
  // 実行: 続けて Tab を押す
  await page.keyboard.press("Tab");
  // 検証: 本文の列の中で最初にフォーカスできる要素へ移る
  const first = await page.evaluate(() => {
    const content = document.querySelector("#doc > .mdmark-content");
    const focusable = content?.querySelector(
      'a[href], button:not([hidden]), [tabindex]:not([tabindex="-1"])',
    );
    return focusable === document.activeElement;
  });
  expect(first).toBe(true);
});

// 文書を開いた直後と、出し始める量より少なくスクロールした間は、先頭へ戻るボタンを出さず Tab でも届かない（正常シナリオ（先頭の近くでは出さない））
test("test_normal_when_near_top", async ({ page }) => {
  // 準備・実行: 文書を開く
  await openLongDocument(page);
  const button = backToTop(page);
  // 検証
  await expect(page.locator("#doc > button.mdmark-back-to-top")).toBeAttached();
  await expect(button).toBeHidden();
  const focusable = await page
    .locator("#doc > button.mdmark-back-to-top")
    .evaluate((element: HTMLElement) => {
      element.focus();
      return document.activeElement === element;
    });
  expect(focusable).toBe(false);
  // 実行: 出し始める量（画面の高さ 1 つ分）より少なくスクロールする
  await page.evaluate(() => {
    const top =
      document.querySelector("#doc")?.getBoundingClientRect().top ?? 0;
    window.scrollTo(0, window.scrollY + top + window.innerHeight / 2);
  });
  // 検証
  await expect(button).toBeHidden();
});

// Tab でボタンへフォーカスを移し、Enter と Space で押して文書の先頭へ戻る（正常シナリオ（キーボードで押す））
test("test_normal_when_pressed_by_keyboard", async ({ page }) => {
  // 準備
  await openLongDocument(page);
  const button = backToTop(page);
  await scrollToEnd(page);
  await expect(button).toBeVisible();
  // 実行: Tab でボタンへフォーカスを移す
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await tabTo(page, button);
  // 検証
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS("outline-style", "solid");
  // 実行: Enter を押す
  await page.keyboard.press("Enter");
  // 検証
  await expect(heading(page, "導入")).toBeInViewport();
  // 実行: 末尾へもう一度スクロールし、Tab でボタンへ移って Space を押す
  await scrollToEnd(page);
  await expect(button).toBeVisible();
  await tabTo(page, button);
  await page.keyboard.press("Space");
  // 検証
  await expect(heading(page, "導入")).toBeInViewport();
});

// スクロールする祖先の要素の中に描いた文書で、その要素の末尾までスクロールしてボタンを押すと、その要素を先頭へスクロールする（正常シナリオ（スクロールする祖先の要素の中に描いた文書））
test("test_normal_when_scroll_container", async ({ page }) => {
  // 準備: 描く先の要素を、高さ 600px で縦にスクロールする要素の中へ移してから描く
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "box";
    box.style.height = "600px";
    box.style.overflowY = "auto";
    const doc = document.querySelector("#doc") as HTMLElement;
    doc.before(box);
    box.append(doc);
  });
  await mountDocument(page, { markdown: LONG_MARKDOWN });
  const button = backToTop(page);
  // 実行: スクロールする要素の中で末尾までスクロールする
  await page.evaluate(() => {
    const box = document.querySelector("#box") as HTMLElement;
    box.scrollTop = box.scrollHeight;
  });
  // 検証
  await expect(button).toBeVisible();
  // 実行: ボタンを押す
  await button.click();
  // 検証: スクロールする要素の scrollTop が描いた文書の先頭の位置になる
  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = document.querySelector("#box") as HTMLElement;
        const doc = document.querySelector("#doc") as HTMLElement;
        return Math.abs(
          doc.getBoundingClientRect().top -
            (box.getBoundingClientRect().top + box.clientTop),
        );
      }),
    )
    .toBeLessThanOrEqual(1);
  await expect(page.evaluate(() => window.scrollY)).resolves.toBe(0);
});

// 右側の目次を出し続けたページで、先頭へ戻るボタンが目次と重ならず、目次の最後の項目を押せる（正常シナリオ（右側の目次と重ならない））
test("test_normal_when_side_toc_shown", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: LONG_MARKDOWN,
    config: { "side-toc": { mode: "fixed" } },
  });
  const toggle = page.locator("#doc .mdmark-side-toc-toggle");
  await toggle.click();
  const panel = page.locator("#doc .mdmark-side-toc-panel");
  await expect(panel).toBeVisible();
  // 実行: 文書の末尾までスクロールする
  await scrollToEnd(page);
  // 検証
  const button = backToTop(page);
  await expect(button).toBeVisible();
  const buttonBox = await boxOf(button);
  expect(overlaps(buttonBox, await boxOf(panel))).toBe(false);
  expect(overlaps(buttonBox, await boxOf(toggle))).toBe(false);
  // 実行: 右側の目次の最後の項目を押す
  await panel.locator('a[data-heading-id="付録"]').click();
  // 検証
  await expect(heading(page, "付録")).toBeInViewport();
});

// 差分を開いたページで、先頭へ戻るボタンがミニマップの帯と重ならず、帯の末尾の近くのマーカーを押せる（正常シナリオ（差分のミニマップと重ならない））
test("test_normal_when_diff_minimap_shown", async ({ page }) => {
  // 準備: 末尾の近くの段落を書き換えた 2 つのリビジョン
  const changed = LONG_MARKDOWN.replace(
    "付録の段落 9 は",
    "付録の段落 9 を書き換えた本文は",
  );
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: changed,
    docId: DIFF_DOC_ID,
    source: {
      revisions: DIFF_REVISIONS.slice(1),
      contents: { r1: LONG_MARKDOWN, r2: changed },
    },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
  const band = page.locator("body > .mdmark-diff-minimap");
  await expect(band).toHaveCount(1);
  // 実行: 差分の末尾までスクロールする
  await scrollToEnd(page);
  // 検証
  const button = backToTop(page);
  await expect(button).toBeVisible();
  expect(overlaps(await boxOf(button), await boxOf(band))).toBe(false);
  // 実行: 帯の末尾の近くのマーカーを押す
  await page.evaluate(() => window.scrollTo(0, 0));
  const mark = band.locator(".mdmark-diff-minimap-mark").last();
  const bandBox = await boxOf(band);
  const markBox = await boxOf(mark);
  await band.click({
    position: {
      x: bandBox.width / 2,
      y: markBox.y - bandBox.y + markBox.height / 2,
    },
  });
  // 検証
  await expect(
    page
      .locator("#doc .mdmark-diff-line", { hasText: "を書き換えた本文は" })
      .first(),
  ).toBeInViewport();
});

// コメントの機能をオンにしたページで、先頭へ戻るボタンが余白のマーカーと重ならず、マーカーを押して吹き出しを開ける（正常シナリオ（余白のマーカーと重ならない））
test("test_normal_when_comment_margin_shown", async ({ page }) => {
  // 準備: `## 付録` の段落の箇所に付いたコメント 1 件
  await openPage(page, builtRoot);
  await installCommentStore(page, {
    loaded: [
      {
        id: "c1",
        quote: "付録の段落 3 は",
        prefix: "",
        suffix: "",
        body: "末尾の近くのコメント",
      },
    ],
  });
  await mountDocument(page, {
    markdown: LONG_MARKDOWN,
    config: { features: { comments: true } },
    docId: "guide",
    useCommentStore: true,
  });
  const marker = page.locator(
    "#doc > .mdmark-comment-margin > button.mdmark-comment-marker",
  );
  await expect(marker).toHaveCount(1);
  // 実行: 文書の末尾までスクロールする
  await scrollToEnd(page);
  // 検証
  const button = backToTop(page);
  await expect(button).toBeVisible();
  await marker.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  expect(overlaps(await boxOf(button), await boxOf(marker))).toBe(false);
  // 実行: 余白のマーカーを押す
  await marker.click();
  // 検証
  await expect(page.locator(".mdmark-comment-bubble")).toBeVisible();
});

// ライトボックスを開いている間は先頭へ戻るボタンがその後ろに隠れて Tab でも届かず、閉じると右下に出る（正常シナリオ（ライトボックスを開いている間））
test("test_normal_when_lightbox_open", async ({ page }) => {
  // 準備: 末尾に画像を持つ長い文書
  await routePageFiles(page, {
    "chart.png": colorSvg({ width: 640, height: 400, color: "#0f766e" }),
  });
  await openLongDocument(page, `${LONG_MARKDOWN}\n![グラフ](chart.png)\n`);
  await scrollToEnd(page);
  const button = backToTop(page);
  await expect(button).toBeVisible();
  // 実行: 画像を押す
  await page.locator("#doc button.mdmark-image-open").click();
  // 検証: ボタンの位置で一番前にあるのはライトボックスで、Tab でボタンへ届かない
  await expect(page.locator("#doc dialog.mdmark-lightbox[open]")).toBeVisible();
  const box = await boxOf(button);
  const front = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest("dialog.mdmark-lightbox") !==
      null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(front).toBe(true);
  await expect(tabTo(page, button)).rejects.toThrow();
  // 実行: Esc を押す
  await page.keyboard.press("Escape");
  // 検証
  await expect(page.locator("#doc dialog.mdmark-lightbox[open]")).toHaveCount(
    0,
  );
  await expect(button).toBeVisible();
  const after = await boxOf(button);
  expect(after.x + after.width).toBeGreaterThan(1280 / 2);
  expect(after.y + after.height).toBeGreaterThan(800 / 2);
});

test.describe("狭い幅のタッチの端末", () => {
  test.use({ hasTouch: true });

  // 狭い幅でもボタンが画面の中に収まり、44px 以上のボタンをタップすると文書の先頭へ戻る（正常シナリオ（狭い幅））
  test("test_normal_when_narrow_width", async ({ page }) => {
    // 準備
    await page.setViewportSize({ width: 390, height: 844 });
    await openLongDocument(page);
    // 実行: 文書の末尾までスクロールする
    await scrollToEnd(page);
    // 検証
    const button = backToTop(page);
    await expect(button).toBeVisible();
    const box = await boxOf(button);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    expect(box.width).toBeGreaterThanOrEqual(MIN_SIZE_PX);
    expect(box.height).toBeGreaterThanOrEqual(MIN_SIZE_PX);
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
    // 実行: ボタンをタップする
    await button.tap();
    // 検証
    await expect(heading(page, "導入")).toBeInViewport();
  });
});
