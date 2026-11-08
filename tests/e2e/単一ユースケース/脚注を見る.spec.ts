import { expect, type Locator, type Page, test } from "@playwright/test";
import type { MdmarkIndex } from "../../../src/index.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 操作が要素に届かないときに、ケースの上限まで待たずに落とす（expect の待ちと同じ 30 秒）
test.use({ actionTimeout: 30_000 });

// 1 つ目の段落に参照、2 つ目の段落に行内の脚注を持ち、定義を本文の途中に置いた文書
const MARKDOWN = [
  "出典がある[^src]。",
  "",
  "[^src]: 出典の説明",
  "",
  "行内にも書ける^[行内の補足]。",
  "",
].join("\n");

// 描く文書の索引の id
const DOC_ID = "doc";

// 用語 `ワークスペース` を持ち、描く文書を持つ索引
const INDEX: MdmarkIndex = {
  schema: 2,
  docs: [{ id: DOC_ID, path: "doc.md", title: "描く文書" }],
  terms: [
    {
      id: "workspace",
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 描いた文書の中の、`n` 番目（1 から）の脚注の番号の組 */
function footnoteRef(page: Page, n: number): Locator {
  return page.locator("#doc .mdmark-fn-ref").nth(n - 1);
}

/** ポインターを番号とツールチップの外へ出し、開いていたツールチップが消えるのを待つ（開いたツールチップは次の段落の番号に重なりうる） */
async function moveAway(page: Page, tip: Locator): Promise<void> {
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
}

// 参照の場所に番号を置き、ポインターでツールチップを出し、末尾に閉じた脚注の一覧を置く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  const paragraphs = page.locator("#doc > p");
  await expect(paragraphs.nth(0).locator(".mdmark-fn-link")).toContainText("1");
  await expect(paragraphs.nth(1).locator(".mdmark-fn-link")).toContainText("2");
  const doc = page.locator("#doc");
  const shown = await doc.innerText();
  expect(shown).not.toContain("[^src]");
  expect(shown).not.toContain("^[");
  // 番号 1: ポインターを乗せると出て、ツールチップの上へ移っても出たまま
  const firstTip = footnoteRef(page, 1).locator(".mdmark-fn-tip");
  await expect(firstTip).toBeHidden();
  await footnoteRef(page, 1).locator(".mdmark-fn-link").hover();
  await expect(firstTip).toBeVisible();
  await expect(firstTip).toContainText("出典の説明");
  await firstTip.hover();
  await expect(firstTip).toBeVisible();
  await moveAway(page, firstTip);
  // 番号 2: ポインターを乗せると出る
  const secondTip = footnoteRef(page, 2).locator(".mdmark-fn-tip");
  await footnoteRef(page, 2).locator(".mdmark-fn-link").hover();
  await expect(secondTip).toBeVisible();
  await expect(secondTip).toContainText("行内の補足");
  // 末尾の一覧は描いた直後は閉じている
  const list = doc.locator("details.mdmark-footnotes");
  await expect(list).not.toHaveAttribute("open", "");
  await expect(list.locator(".mdmark-fn-item").first()).toBeHidden();
});

// Tab で番号へフォーカスを移してツールチップを読み、Esc で消す（正常シナリオ（キーボードで読む））
test("test_normal_when_keyboard", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: MARKDOWN });
  // 実行
  await page.keyboard.press("Tab");
  // 検証
  const link = footnoteRef(page, 1).locator(".mdmark-fn-link");
  await expect(link).toBeFocused();
  const tipId = await link.getAttribute("aria-describedby");
  const tip = page.locator(`[id="${tipId}"]`);
  await expect(tip).toHaveAttribute("role", "tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("出典の説明");
  // 実行
  await page.keyboard.press("Escape");
  // 検証
  await expect(tip).toBeHidden();
  await expect(link).toBeFocused();
});

// 見出しを押して一覧を開き、戻るリンクで本文の番号へ戻る（正常シナリオ（末尾の一覧から本文へ戻る））
test("test_normal_when_back_from_list", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: MARKDOWN });
  const list = page.locator("#doc details.mdmark-footnotes");
  // 実行
  await list.locator("summary").click();
  // 検証
  const items = list.locator(".mdmark-fn-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("出典の説明");
  await expect(items.nth(1)).toContainText("行内の補足");
  // 実行
  await items.nth(0).locator(".mdmark-fn-back").click();
  // 検証
  const link = footnoteRef(page, 1).locator(".mdmark-fn-link");
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
});

// 同じラベルの 2 回の参照に同じ番号を振り、一覧の項目に戻るリンクを 2 つ置く（正常シナリオ（同じ脚注を複数回参照する））
test("test_normal_when_referenced_twice", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "一つ目[^note]。\n\n二つ目[^note]。\n\n[^note]: 共通の補足\n",
  });
  // 検証
  for (const n of [1, 2]) {
    const ref = footnoteRef(page, n);
    await expect(ref.locator(".mdmark-fn-link")).toContainText("1");
    await ref.locator(".mdmark-fn-link").hover();
    await expect(ref.locator(".mdmark-fn-tip")).toBeVisible();
    await expect(ref.locator(".mdmark-fn-tip")).toContainText("共通の補足");
    await moveAway(page, ref.locator(".mdmark-fn-tip"));
  }
  const list = page.locator("#doc details.mdmark-footnotes");
  await list.locator("summary").click();
  await expect(list.locator(".mdmark-fn-item")).toHaveCount(1);
  await expect(list.locator(".mdmark-fn-back")).toHaveCount(2);
});

// 用語の下線と脚注の番号を形で見分け、それぞれのツールチップを出す（正常シナリオ（用語と脚注が同じ段落に出る））
test("test_normal_when_with_terms", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "ワークスペースに置く[^1]。\n\n[^1]: 補足の文\n",
    index: INDEX,
    docId: DOC_ID,
  });
  // 検証
  const ref = footnoteRef(page, 1);
  const link = ref.locator(".mdmark-fn-link");
  await expect(ref).toHaveCSS("vertical-align", "super");
  await expect(link).toHaveCSS("text-decoration-line", "none");
  await link.hover();
  const fnTip = ref.locator(".mdmark-fn-tip");
  await expect(fnTip).toBeVisible();
  await expect(fnTip.locator(".mdmark-fn-tip-title")).toHaveText("脚注 1");
  await expect(fnTip.locator(".mdmark-term-tip-heading")).toHaveCount(0);
  const term = page.locator("#doc .mdmark-term");
  await term.hover();
  const termTip = page.locator("#doc .mdmark-term-tip");
  await expect(termTip).toBeVisible();
  await expect(termTip.locator(".mdmark-term-tip-heading")).toHaveText("用語");
  await expect(termTip.locator(".mdmark-fn-tip-title")).toHaveCount(0);
});

// 定義の無い参照は書いた文字のまま出し、番号と一覧を置かない（異常シナリオ（定義の無い参照））
test("test_error_when_definition_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: "定義の無い参照[^missing]。\n" });
  // 検証
  await expect(page.locator("#doc > p")).toHaveText(
    "定義の無い参照[^missing]。",
  );
  await expect(page.locator("#doc .mdmark-fn-ref")).toHaveCount(0);
  await expect(page.locator("#doc details.mdmark-footnotes")).toHaveCount(0);
});

// 番号を押すか Enter で、閉じた一覧を開いて該当の項目へ移る（正常シナリオ（番号から末尾の一覧へ移る））
test("test_normal_when_jump_to_list", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: MARKDOWN });
  const list = page.locator("#doc details.mdmark-footnotes");
  const items = list.locator(".mdmark-fn-item");
  // 実行
  await footnoteRef(page, 2).locator(".mdmark-fn-link").click();
  // 検証
  await expect(list).toHaveAttribute("open", "");
  await expect(items.nth(1)).toContainText("行内の補足");
  await expect(items.nth(1)).toBeFocused();
  await expect(items.nth(1)).toBeInViewport();
  // 実行
  await list.locator("summary").click();
  await expect(list).not.toHaveAttribute("open", "");
  // Tab の起点を番号 1 の前に置く（`blur()` では起点が押した見出しのまま残る）
  await page
    .locator("#doc > p")
    .first()
    .click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("Tab");
  await expect(footnoteRef(page, 1).locator(".mdmark-fn-link")).toBeFocused();
  await page.keyboard.press("Enter");
  // 検証
  await expect(list).toHaveAttribute("open", "");
  await expect(items.nth(0)).toContainText("出典の説明");
  await expect(items.nth(0)).toBeFocused();
  await expect(items.nth(0)).toBeInViewport();
});

// タップで開いたツールチップが、閉じる待ちの後も出たままかを確かめるまでの時間（ミリ秒）
const TOUCH_CLOSE_WAIT_MS = 500;

test.describe("タッチの端末", () => {
  test.use({ hasTouch: true });

  // 閉じた番号のタップでツールチップを出し、外のタップで消し、開いた番号のタップで一覧へ移る（正常シナリオ（タッチ））
  test("test_normal_when_touch", async ({ page }) => {
    // 準備
    await openPage(page, builtRoot);
    await mountDocument(page, {
      markdown: `${MARKDOWN}\n脚注を含まない段落。\n`,
    });
    const link = footnoteRef(page, 1).locator(".mdmark-fn-link");
    const tip = footnoteRef(page, 1).locator(".mdmark-fn-tip");
    const list = page.locator("#doc details.mdmark-footnotes");
    const item = list.locator(".mdmark-fn-item").nth(0);
    const outside = page.locator("#doc p", { hasText: "脚注を含まない段落" });
    // 実行・検証: 閉じた番号のタップでツールチップが出て、一覧は閉じたまま
    await link.tap();
    await page.waitForTimeout(TOUCH_CLOSE_WAIT_MS);
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("出典の説明");
    await expect(list).not.toHaveAttribute("open", "");
    // 実行・検証: ツールチップと番号の外のタップで消える
    await outside.tap();
    await expect(tip).toBeHidden();
    // 実行・検証: 消えた後の番号のタップでもう一度出る
    await link.tap();
    await page.waitForTimeout(TOUCH_CLOSE_WAIT_MS);
    await expect(tip).toBeVisible();
    // 実行・検証: 開いた番号のタップで消え、一覧が開いて項目へ移る
    await link.tap();
    await expect(tip).toBeHidden();
    await expect(list).toHaveAttribute("open", "");
    await expect(item).toContainText("出典の説明");
    await expect(item).toBeFocused();
    await expect(item).toBeInViewport();
  });
});
