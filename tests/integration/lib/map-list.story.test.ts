import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 部品『mapの一覧』のストーリーを開く */
function openList(id: string, viewport?: { width: number; height: number }) {
  return holder.openStory(`parts-maplist--${id}`, viewport);
}

/** 一覧の項目の ID・階層・開閉・名前（DOM の順） */
function itemsOf(page: Page) {
  return page.locator('[role="treeitem"]').evaluateAll((items) =>
    items.map((item) => ({
      id: item.getAttribute("data-id"),
      level: item.getAttribute("aria-level"),
      expanded: item.getAttribute("aria-expanded"),
      shown: item.getClientRects().length > 0,
      label: item.getAttribute("aria-label") ?? "",
    })),
  );
}

// 構成図の一覧は、グループを入れ子の項目にし、ノードの項目が名前・種類・説明・出る線を持つ（Flow）
test("test_flow", async () => {
  // 準備・実行
  const page = await openList("flow");
  // 検証
  await expect(
    page.locator('[role="tree"]').getAttribute("aria-label"),
  ).resolves.toBe("全体の構成の一覧");
  const items = await itemsOf(page);
  const lib = items.find((item) => item.id === "lib");
  expect(lib?.expanded).toBe("true");
  expect(items.find((item) => item.id === "read")?.level).toBe("2");
  expect(items.find((item) => item.id === "marker")?.level).toBe("3");
  const data = page.locator('[role="treeitem"][data-id="data"]');
  const text = await data.locator(":scope > .mdmark-map-list-row").innerText();
  expect(text).toContain("補足の検査");
  expect(text).toContain("処理");
  expect(text).toContain("version と機能ごとのキーをスキーマで検査する");
  expect(text).toContain("→ 図の枠");
  await expect(
    page.locator('[role="treeitem"][tabindex="0"]').count(),
  ).resolves.toBe(1);
});

// 計画した変更を持つ構成図の一覧は、変更の名前のバッジを持ち、削除の項目の名前に取り消し線を引く（WithChanges）
test("test_with_changes", async () => {
  // 準備・実行
  const page = await openList("with-changes");
  // 検証
  const badge = (id: string) =>
    page
      .locator(
        `[role="treeitem"][data-id="${id}"] > .mdmark-map-list-row .mdmark-map-change`,
      )
      .innerText();
  await expect(badge("mount")).resolves.toBe("変更");
  await expect(badge("user")).resolves.toBe("追加");
  await expect(badge("legacy")).resolves.toBe("削除");
  const legacy = await page
    .locator(
      '[role="treeitem"][data-id="legacy"] > .mdmark-map-list-row .mdmark-map-list-name',
    )
    .evaluate((name) => getComputedStyle(name).textDecorationLine);
  expect(legacy).toContain("line-through");
  const label = await page
    .locator('[role="treeitem"][data-id="mount"]')
    .getAttribute("aria-label");
  expect(label?.startsWith("mount、変更、処理")).toBe(true);
});

// シーケンス図の一覧は、メッセージを記載順に並べ、子を持つ項目が無い（Sequence）
test("test_sequence", async () => {
  // 準備・実行
  const page = await openList("sequence");
  // 検証
  const items = await itemsOf(page);
  expect(items.map((item) => item.id)).toEqual([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
  ]);
  expect(items.every((item) => item.expanded === null)).toBe(true);
  expect(items[0]?.label).toBe("利用側のページ → mount: 設定と Markdown");
});

// 閉じた項目は aria-expanded="false" で、中の項目が隠れる（GroupCollapsed）
test("test_group_collapsed", async () => {
  // 準備・実行
  const page = await openList("group-collapsed");
  // 検証
  const items = await itemsOf(page);
  expect(items.find((item) => item.id === "read")?.expanded).toBe("false");
  for (const id of ["marker", "mermaid"])
    expect(items.find((item) => item.id === id)?.shown).toBe(false);
  await expect(
    page.locator('[role="treeitem"][data-id="read"]').getAttribute("tabindex"),
  ).resolves.toBe("0");
});

// 幅 390px では、項目の名前・バッジ・種類が折り返し、横にはみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  // 幅 390px の置き場所（ストーリーの枠）とページの余白が収まる画面で開く
  const page = await openList("narrow", { width: 480, height: 844 });
  // 検証
  const fits = await page
    .locator('[role="tree"]')
    .evaluate((tree) => tree.scrollWidth <= tree.clientWidth + 1);
  expect(fits).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
