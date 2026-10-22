import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 選ぶ欄の選択肢の状態 */
async function readSelect(
  page: Awaited<ReturnType<typeof holder.openStory>>,
  label: string,
) {
  return page.evaluate((labelText) => {
    const found = [...document.querySelectorAll("label")].find(
      (candidate) => candidate.textContent === labelText,
    );
    const select = document.getElementById(
      found?.htmlFor ?? "",
    ) as HTMLSelectElement;
    return {
      value: select.value,
      disabled: [...select.options]
        .filter((option) => option.disabled)
        .map((option) => option.value),
      texts: [...select.options].map((option) => option.textContent),
      width: select.getBoundingClientRect().width,
      parentWidth: (select.parentElement as HTMLElement).getBoundingClientRect()
        .width,
    };
  }, label);
}

// 3 つのリビジョンを新しい順に並べ、一番新しいものとその 1 つ前を選ぶ（Normal）
test("test_normal", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-revisionpicker--normal");
  // 検証
  const before = await readSelect(page, "前のリビジョン");
  const after = await readSelect(page, "後のリビジョン");
  expect(before.value).toBe("r2");
  expect(after.value).toBe("r3");
  expect(before.disabled).toEqual(["r3"]);
  expect(after.disabled).toEqual(["r2", "r1"]);
  expect(before.texts[1]).toBe("2026/10/19 16:40 件数を直す（鈴木）");
  await expect(page.locator(".mdmark-diff-summary").innerText()).resolves.toBe(
    "削除した行 1・追加した行 8",
  );
  await expect(
    page.locator(".mdmark-diff-summary").getAttribute("role"),
  ).resolves.toBe("status");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 前に r2 を選んだとき、後の欄では r2 と r1 を選べない（BeforeSelected）
test("test_before_selected", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-revisionpicker--before-selected");
  // 検証
  const after = await readSelect(page, "後のリビジョン");
  expect(after.disabled).toEqual(["r2", "r1"]);
  await expect(page.locator(".mdmark-diff-summary").innerText()).resolves.toBe(
    "",
  );
});

// label と author が無いリビジョンは日時だけを出し、長い項目は欄の中で切る（Sparse）
test("test_sparse", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-revisionpicker--sparse");
  // 検証
  const before = await readSelect(page, "前のリビジョン");
  expect(before.texts[1]).toBe("2026/10/18 09:12");
  const after = await readSelect(page, "後のリビジョン");
  expect(after.texts[0]).toContain("問い合わせ窓口の運用担当のとても長い名前");
  expect(after.width).toBeLessThanOrEqual(after.parentWidth + 1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
