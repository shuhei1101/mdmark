import { expect, test } from "@playwright/test";
import {
  DIFF_CONTENTS,
  DIFF_DOC_ID,
  DIFF_PAGE_MARKDOWN,
  DIFF_REVISIONS,
  sampleBody,
} from "../diff-samples.ts";
import {
  afterSelect,
  backgroundOf,
  beforeSelect,
  diffLines,
  disabledValues,
  toggleOf,
  waitForDiff,
} from "../diff-ui.ts";
import {
  buildDistRoot,
  mountDiffDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** `r1`・`r2` の 2 つのリビジョンで文書を描き、差分を開く */
async function openTwoRevisions(
  page: import("@playwright/test").Page,
): Promise<void> {
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: {
      revisions: DIFF_REVISIONS.slice(1),
      contents: DIFF_CONTENTS,
    },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
}

// 消した行は赤と `-`、足した行は緑と `+`、対の行で変わった語だけが濃い色で出る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備・実行
  await openTwoRevisions(page);
  // 検証: 行の色と印
  const del = diffLines(page, "del");
  const add = diffLines(page, "add");
  const same = diffLines(page, "same").first();
  await expect(del).toHaveCount(2);
  await expect(add).toHaveCount(2);
  const [delColor, addColor, sameColor] = [
    await backgroundOf(del.first()),
    await backgroundOf(add.first()),
    await backgroundOf(same),
  ];
  expect(delColor).not.toBe(sameColor);
  expect(addColor).not.toBe(sameColor);
  expect(delColor).not.toBe(addColor);
  await expect(del.first().locator(".mdmark-diff-sign")).toHaveText("-");
  await expect(add.first().locator(".mdmark-diff-sign")).toHaveText("+");
  await expect(same.locator(".mdmark-diff-sign")).toHaveText("");
  // 読み上げの名前
  await expect(del.first().locator(".mdmark-visually-hidden")).toHaveText(
    "削除した行:",
  );
  await expect(add.first().locator(".mdmark-visually-hidden")).toHaveText(
    "追加した行:",
  );
  // 語を書き換えた行の対で、変わった語だけが濃い色
  const delWord = page.locator("#doc del.mdmark-diff-word");
  const addWord = page.locator("#doc ins.mdmark-diff-word");
  await expect(delWord).toHaveText("差分");
  await expect(addWord).toHaveText("変更");
  expect(await backgroundOf(delWord)).not.toBe(delColor);
  expect(await backgroundOf(addWord)).not.toBe(addColor);
  // 差分の行は、Markdown のソースの行の文字のまま
  await expect(page.locator("#doc .mdmark-diff-lines")).toContainText(
    "# 問い合わせ窓口の週の報告",
  );
  await expect(page.locator("#doc .mdmark-diff-lines")).toContainText(
    "よくある質問の変更は、担当者が週に 1 回確かめます。",
  );
  // 画面の右端のミニマップに、消した行・足した行の印が並ぶ
  const band = page.locator("body > .mdmark-diff-minimap");
  await expect(band).toHaveCount(1);
  await expect(band.locator('[data-kind="del"]').first()).toBeAttached();
  await expect(band.locator('[data-kind="add"]').first()).toBeAttached();
});

// 前のリビジョンを選び直すと、その 2 つの差分に描き直し、後の欄では古いリビジョンを選べない（正常シナリオ（リビジョンを選び直す））
test("test_normal_when_revisions_changed", async ({ page }) => {
  // 準備: r2 から見出しを 1 つ書き換えた r3 を足した 3 つのリビジョン
  const contents = {
    ...DIFF_CONTENTS,
    r3: sampleBody({
      word: "変更",
      legacy: false,
      phone: true,
      mail: 120,
      heading: "窓口別の件数",
    }),
  };
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: { revisions: DIFF_REVISIONS, contents },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
  // 検証: 開いた時点では r2 と r3 で、書き換えた見出しの行だけが差分に出る
  await expect(beforeSelect(page)).toHaveValue("r2");
  await expect(afterSelect(page)).toHaveValue("r3");
  await expect(diffLines(page, "del")).toHaveCount(1);
  await expect(diffLines(page, "del")).toContainText("窓口ごとの件数");
  await expect(diffLines(page, "add")).toContainText("窓口別の件数");
  // 実行: 前に r1、後に r2 を選ぶ
  await beforeSelect(page).selectOption("r1");
  await afterSelect(page).selectOption("r2");
  // 検証: 正常シナリオと同じ差分
  await expect(diffLines(page, "del")).toHaveCount(2);
  await expect(diffLines(page, "add")).toHaveCount(2);
  await expect(page.locator("#doc del.mdmark-diff-word")).toHaveText("差分");
  // 後の欄では、前の欄で選んだリビジョンより古いリビジョンを選べない
  expect(await disabledValues(afterSelect(page))).toEqual(["r1"]);
});

// 選んだ 2 つの本文が同じなら、赤と緑の行を出さずに変更が無いことを知らせる（正常シナリオ（変更が無い））
test("test_normal_when_no_change", async ({ page }) => {
  // 準備
  const same = sampleBody({
    word: "差分",
    legacy: true,
    phone: false,
    mail: 120,
  });
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: {
      revisions: [
        { id: "r2", at: "2026-10-19T07:40:00Z", label: "題の表記を確かめる" },
        DIFF_REVISIONS[2],
      ].filter((revision) => revision !== undefined),
      contents: { r1: same, r2: same },
    },
  });
  // 実行
  await toggleOf(page).click();
  // 検証
  await expect(page.locator("#doc")).toContainText(
    "選んだ 2 つのリビジョンの本文に、変更はありません。",
  );
  await expect(diffLines(page, "del")).toHaveCount(0);
  await expect(diffLines(page, "add")).toHaveCount(0);
});

// `Intl.Segmenter` を持たないブラウザでは、対の行を 1 文字ずつ比べて、変わった文字を濃い色にする（正常シナリオ（語の区切りを持たないブラウザ））
test("test_normal_when_no_segmenter", async ({ page }) => {
  // 準備: ページを開く前に `Intl.Segmenter` を消す（対応ブラウザの Firefox 98〜124 の代わり）
  await page.addInitScript(() => {
    Reflect.deleteProperty(Intl, "Segmenter");
  });
  await openTwoRevisions(page);
  // 検証: 消した行・足した行は正常シナリオと同じで、変わった文字が濃い色
  await expect(diffLines(page, "del")).toHaveCount(2);
  await expect(diffLines(page, "add")).toHaveCount(2);
  const delWords = await page
    .locator("#doc del.mdmark-diff-word")
    .allInnerTexts();
  const addWords = await page
    .locator("#doc ins.mdmark-diff-word")
    .allInnerTexts();
  expect(delWords.join("")).toBe("差分");
  expect(addWords.join("")).toBe("変更");
});

// 差分を閉じると、差分とミニマップを片付けて本文に戻り、フォーカスがボタンに戻る（正常シナリオ（差分を閉じる））
test("test_normal_when_closed", async ({ page }) => {
  // 準備
  await openTwoRevisions(page);
  // 実行
  await toggleOf(page).focus();
  await toggleOf(page).press("Enter");
  // 検証
  await expect(page.locator("#doc .mdmark-diff-line")).toHaveCount(0);
  await expect(page.locator("body > .mdmark-diff-minimap")).toHaveCount(0);
  await expect(page.locator("#doc p")).toHaveText("本文の段落。");
  await expect(toggleOf(page)).toBeFocused();
  await expect(toggleOf(page)).toHaveAttribute("aria-expanded", "false");
});

// 長い文書の差分を、ミニマップの帯を押す・押したまま動かすで送る（正常シナリオ（長い文書をミニマップで送る））
test("test_normal_when_scrolled_by_minimap", async ({ page }) => {
  // 準備: 変えていない行が多く、前半と後半に変えた行がある 2 つのリビジョン
  const body = (changed: boolean): string => {
    const lines = ["# 長い文書"];
    for (let index = 0; index < 150; index += 1) {
      lines.push(`変えない行 ${index}`);
      if (changed && index === 12) {
        lines.push("前半で足した行");
      }
      if (changed && index === 130) {
        lines.push("後半で足した行");
      }
    }
    return `${lines.join("\n")}\n`;
  };
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: {
      revisions: DIFF_REVISIONS.slice(1),
      contents: { r1: body(false), r2: body(true) },
    },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
  const band = page.locator("body > .mdmark-diff-minimap");
  await expect(band).toHaveCount(1);
  const box = await band.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) {
    throw new Error("帯か画面の大きさが取れない");
  }
  // 検証: 帯は画面の右端に、画面の高さいっぱいで貼り付く
  expect(Math.abs(box.height - viewport.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.x + box.width - viewport.width)).toBeLessThanOrEqual(20);
  const frame = band.locator(".mdmark-diff-minimap-view");
  const frameTop = async () => (await frame.boundingBox())?.y ?? 0;
  const topAtStart = await frameTop();
  const inView = async (text: string) =>
    page
      .locator("#doc .mdmark-diff-line", { hasText: text })
      .evaluate(
        (element) =>
          element.getBoundingClientRect().top >= 0 &&
          element.getBoundingClientRect().bottom <= window.innerHeight,
      );
  // 実行: 帯の後半の印の位置を押す
  const lastMark = await band
    .locator(".mdmark-diff-minimap-mark")
    .last()
    .boundingBox();
  if (!lastMark) {
    throw new Error("印が取れない");
  }
  await page.mouse.click(box.x + 5, lastMark.y + lastMark.height / 2);
  // 検証: 後半の変えた行が画面に入り、枠が下がる
  await expect.poll(() => inView("後半で足した行")).toBe(true);
  expect(await frameTop()).toBeGreaterThan(topAtStart);
  // 実行: 帯を押したまま上へ動かす
  await page.mouse.move(box.x + 5, box.y + box.height * 0.9);
  await page.mouse.down();
  await page.mouse.move(box.x + 5, box.y + 4, { steps: 10 });
  await page.mouse.up();
  // 検証
  await expect.poll(() => inView("前半で足した行")).toBe(true);
});
