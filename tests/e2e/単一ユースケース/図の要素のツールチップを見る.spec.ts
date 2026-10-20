import { expect, type Page, test } from "@playwright/test";
import { flowMarkdown, TERM_INDEX } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// ツールチップを離れたポインターが、ツールチップの上へ移る間に閉じるのを待つ時間（ミリ秒）より長く待つ
const CLOSE_WAIT_MS = 500;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 図を描いたページを開く。`withTerm` なら、索引を渡し、図の外の段落にも用語を書く */
async function openFlow(page: Page, withTerm = false): Promise<void> {
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: withTerm
      ? `${await flowMarkdown()}\n図の外の意思決定モデル。\n`
      : await flowMarkdown(),
    ...(withTerm ? { index: TERM_INDEX } : {}),
  });
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
}

// 矢印のラベルにポインターを乗せると入力の詳細が出て、ツールチップの上へ動かしても消えず、箱の上で入力・処理・出力が出る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openFlow(page);
  const label = page.locator(".mdmark-diagram-label.has-tip", {
    hasText: "メール",
  });
  // 実行: 矢印にポインターを乗せる
  await label.hover();
  // 検証: 入力の詳細を書いたツールチップが出る
  const wireTip = page.locator('[role="tooltip"]', {
    hasText: "件名・本文・送り主のアドレス",
  });
  await expect(wireTip).toBeVisible();
  // 実行・検証: ツールチップの上へポインターを動かしても消えない
  await wireTip.hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  await expect(wireTip).toBeVisible();
  // 実行: LLM の箱にポインターを乗せる
  await page.locator('[data-node="draft"]').hover();
  // 検証: 入力・処理・出力のツールチップが出る
  const ioTip = page.locator('[role="tooltip"]', { hasText: "入力" }).filter({
    hasText: "保存のツールを呼ぶ",
  });
  await expect(ioTip).toBeVisible();
  await expect(ioTip.locator("dt")).toHaveText(["入力", "処理", "出力"]);
  // ツールチップを持つ箱には印があり、持たない箱には無い
  await expect(
    page.locator('[data-node="draft"] .mdmark-diagram-info'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-node="mcp"] .mdmark-diagram-info'),
  ).toHaveCount(0);
});

// Tab で矢印のラベルにフォーカスするとツールチップが出て、Esc で消えてフォーカスはラベルに残る（正常シナリオ（キーボード））
test("test_normal_when_keyboard", async ({ page }) => {
  // 準備
  await openFlow(page);
  await page.locator("#doc").evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  // 実行: Tab でツールチップを持つ矢印のラベルにフォーカスする
  for (let count = 0; count < 40; count += 1) {
    await page.keyboard.press("Tab");
    const reached = await page.evaluate(
      () =>
        document.activeElement?.classList.contains("mdmark-diagram-label") ??
        false,
    );
    if (reached) {
      break;
    }
  }
  const label = page.locator(".mdmark-diagram-label.has-tip:focus");
  await expect(label).toHaveCount(1);
  // 検証: ツールチップが出て、ラベルの aria-describedby がそれを指す
  const tipId = await label.getAttribute("aria-describedby");
  expect(tipId).toBeTruthy();
  const tip = page.locator(`[role="tooltip"][id="${tipId}"]`);
  await expect(tip).toBeVisible();
  // 実行: Esc を押す
  await page.keyboard.press("Escape");
  // 検証: ツールチップが消え、フォーカスはラベルに残る
  await expect(tip).toBeHidden();
  await expect(label).toBeFocused();
});

// 箱の中の用語に本文と同じ破線の下線が引かれ、ポインターで用語集の意味が本文の用語と同じ見た目で出る（正常シナリオ（箱の中の用語））
test("test_normal_when_term", async ({ page }) => {
  // 準備
  await openFlow(page, true);
  const inBox = page.locator("#doc .mdmark-diagram-node .mdmark-term").first();
  const outside = page.locator("#doc > p .mdmark-term");
  // 検証: 下線
  await expect(inBox).toHaveText("意思決定モデル");
  await expect(inBox).toHaveCSS("text-decoration-style", "dashed");
  await expect(outside).toHaveCSS("text-decoration-style", "dashed");
  // 実行: 箱の中の用語にポインターを乗せる
  await inBox.hover();
  // 検証: 用語集の意味のツールチップが出る
  const tipId = await inBox.getAttribute("aria-describedby");
  const tip = page.locator(`[id="${tipId}"]`);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("選択肢から選ぶだけの、速く安い判断用の AI");
  // 本文の用語のツールチップと同じ見た目（文字の大きさ・角丸）
  await outside.hover();
  const outsideTip = page.locator("#doc > p .mdmark-term-tip").first();
  await expect(outsideTip).toBeVisible();
  const looks = (locator: typeof tip) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.fontSize}|${style.borderTopLeftRadius}`;
    });
  expect(await looks(tip)).toBe(await looks(outsideTip));
});
