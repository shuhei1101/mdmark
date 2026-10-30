import { expect, type Frame, type Locator, type Page } from "@playwright/test";

/** 「変更を見る」のボタン */
export function toggleOf(page: Page): Locator {
  return page.getByRole("button", { name: "変更を見る" });
}

/** 前のリビジョンの選ぶ欄 */
export function beforeSelect(page: Page): Locator {
  return page.getByLabel("前のリビジョン");
}

/** 後のリビジョンの選ぶ欄 */
export function afterSelect(page: Page): Locator {
  return page.getByLabel("後のリビジョン");
}

/** 種類ごとの差分の行 */
export function diffLines(page: Page, kind: "same" | "del" | "add"): Locator {
  return page.locator(`#doc .mdmark-diff-line[data-kind="${kind}"]`);
}

/** 差分の行が出るのを待つ */
export async function waitForDiff(page: Page): Promise<void> {
  await page.locator("#doc .mdmark-diff-line").first().waitFor();
}

/** 要素の背景色 */
export function backgroundOf(locator: Locator): Promise<string> {
  return locator.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
}

/** 選ぶ欄で選べない項目の `value` */
export function disabledValues(select: Locator): Promise<string[]> {
  return select.evaluate((element) =>
    [...(element as HTMLSelectElement).options]
      .filter((option) => option.disabled)
      .map((option) => option.value),
  );
}

/** 描いた結果の上で色分けした文書を探す範囲（ページかプレビューのフレーム） */
type Scope = Page | Frame;

/** 色を当てたブロック */
export function diffBlocks(scope: Scope, kind: "add" | "del"): Locator {
  return scope.locator(`div.mdmark-diff-block[data-kind="${kind}"]`);
}

/** 本文の見出し・段落・表の文字を文書の順に並べる */
function contentTexts(scope: Scope): Promise<string[]> {
  return scope.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".mdmark-content h1, .mdmark-content p, .mdmark-content table",
      ),
    ].map((element) => element.textContent ?? ""),
  );
}

/** 色の CSS 変数の値を背景にした要素の、実際の背景色 */
function variableColor(scope: Scope, name: string): Promise<string> {
  return scope.evaluate((variable) => {
    const probe = document.createElement("div");
    probe.style.background = `var(${variable})`;
    (document.querySelector(".mdmark-content") ?? document.body).append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, name);
}

/** 色分けした見本の文書（`BLOCKS_BEFORE` から `BLOCKS_AFTER`）の見え方を確かめる */
export async function expectBlockDiff(scope: Scope): Promise<void> {
  // 変更後の文書が、見出し・表を描いた形で出る
  await expect(scope.locator(".mdmark-content h1")).toHaveText(
    "問い合わせ窓口の週の報告",
  );
  await expect(scope.locator(".mdmark-content table")).toHaveCount(1);
  // 語を書き換えた段落と足した段落が、追加の色とマーカーで出る
  const added = diffBlocks(scope, "add");
  await expect(added).toHaveCount(2);
  await expect(added.nth(0)).toContainText("よくある質問の変更は");
  await expect(added.nth(1)).toContainText("電話の問い合わせは");
  for (const index of [0, 1]) {
    await expect(
      added.nth(index).locator(".mdmark-visually-hidden"),
    ).toHaveText("追加:");
    await expect(
      added.nth(index).locator('.mdmark-diff-block-sign[aria-hidden="true"]'),
    ).toHaveText("+");
  }
  // 消した段落が、変更前の位置に削除の色とマーカーで出る
  const deleted = diffBlocks(scope, "del");
  await expect(deleted).toHaveCount(1);
  await expect(deleted).toContainText("旧い注意の段落です。");
  await expect(deleted.locator(".mdmark-visually-hidden")).toHaveText("削除:");
  await expect(
    deleted.locator('.mdmark-diff-block-sign[aria-hidden="true"]'),
  ).toHaveText("−");
  const texts = await contentTexts(scope);
  const at = (word: string) => texts.findIndex((text) => text.includes(word));
  expect(at("旧い注意の段落です。")).toBeGreaterThan(at("メール"));
  expect(at("旧い注意の段落です。")).toBeLessThan(at("自動返信は"));
  // 変えていない見出し・表・段落は、色とマーカーを持たない
  for (const unchanged of [
    scope.locator(".mdmark-content h1"),
    scope.locator(".mdmark-content table"),
    scope.locator(".mdmark-content p", { hasText: "自動返信は" }),
  ]) {
    await expect(unchanged).toHaveCount(1);
    expect(
      await unchanged.evaluate((element) =>
        element.closest(".mdmark-diff-block"),
      ),
    ).toBeNull();
  }
  // 色は `--mdmark-color-diff-*` の値で出る
  const [addColor, delColor] = [
    await variableColor(scope, "--mdmark-color-diff-add-bg"),
    await variableColor(scope, "--mdmark-color-diff-del-bg"),
  ];
  expect(addColor).not.toBe(delColor);
  expect(await backgroundOf(added.first())).toBe(addColor);
  expect(await backgroundOf(deleted)).toBe(delColor);
}
