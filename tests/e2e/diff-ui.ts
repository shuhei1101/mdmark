import type { Locator, Page } from "@playwright/test";

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
