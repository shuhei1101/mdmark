import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  type Box,
  createBrowserHolder,
  overlaps,
  pageOverflows,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1920, height: 1000 };

/** ストーリーを開く */
function openStory(id: string, viewport = WIDE): Promise<Page> {
  return holder.openStory(`parts-mapmindmap--${id}`, viewport);
}

/** 描いた項目の data-node と矩形と薄くしたか */
function itemsOf(page: Page) {
  return page.locator(".map-mindmap-item").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        id: element.getAttribute("data-node") ?? "",
        dim: element.classList.contains("map-dim"),
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      };
    }),
  );
}

/** 「課題」のうち記載順の番号が num の項目の data-node */
const issue = (num: number) => `n${num}`;

// 根を中央に置き、枝を左右に広げ、形状と枝の色で描き、項目が重ならない（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  const items = await itemsOf(page);
  expect(items).toHaveLength(14);
  for (const [i, a] of items.entries())
    for (const b of items.slice(i + 1))
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
  const root = items.find((item) => item.id === "root") as Box;
  const center = (root.left + root.right) / 2;
  const right = ["a1", "体制", "予算", "スケジュール"].filter((id) => {
    const box = items.find((item) => item.id === id) as Box;
    return box.left > center;
  });
  expect(right).toHaveLength(2);
  await expect(page.locator(".map-mindmap-grip").count()).resolves.toBe(6);
  await expect(page.locator("path.map-mindmap-branch").count()).resolves.toBe(
    13,
  );
  await expect(
    page.locator('[data-node="利用者を増やす"]').getAttribute("data-shape"),
  ).resolves.toBe("plain");
  await expect(
    page.locator(".map-mindmap-item .mdmark-diagram-info").count(),
  ).resolves.toBe(2);
});

// 「体制」を閉じると、開閉のボタンに子孫の数が出て、子孫が無い（Collapsed）
test("test_collapsed", async () => {
  // 準備・実行
  const page = await openStory("collapsed");
  // 検証
  const toggle = page.locator('[data-mindmap-toggle="体制"]');
  await expect(toggle.innerText()).resolves.toBe("3");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(toggle.getAttribute("aria-label")).resolves.toBe(
    "体制の子孫 3 件を開く",
  );
  const ids = (await itemsOf(page)).map((item) => item.id);
  expect(ids).toHaveLength(11);
  expect(ids).not.toContain("人手が足りない");
});

// 「体制」の中へ入ると、体制を根に描き、上端に根からの道筋を出す（Entered）
test("test_entered", async () => {
  // 準備・実行
  const page = await openStory("entered");
  // 検証
  const ids = (await itemsOf(page)).map((item) => item.id);
  expect(ids.sort()).toEqual(
    ["体制", issue(5), "人手が足りない", "担当の割り当て"].sort(),
  );
  await expect(
    page.locator(".map-mindmap-trail").getAttribute("aria-label"),
  ).resolves.toBe("根からの道筋");
  await expect(page.locator(".map-mindmap-trail").innerText()).resolves.toMatch(
    /企画の論点\s*›\s*体制/,
  );
});

// 「体制」を選ぶと、根からの道筋と子孫のほかが薄い（Selected）
test("test_selected", async () => {
  // 準備・実行
  const page = await openStory("selected");
  // 検証
  const items = await itemsOf(page);
  const kept = items.filter((item) => !item.dim).map((item) => item.id);
  expect(kept.sort()).toEqual(
    ["root", "体制", issue(5), "人手が足りない", "担当の割り当て"].sort(),
  );
  await expect(
    page
      .locator('[data-node="体制"] > .mdmark-diagram-node-hit')
      .getAttribute("aria-label"),
  ).resolves.toBe("体制（選択中）");
});

// 形状の指定の無い「利用者を増やす」を選ぶと、根と「目的」と自身だけが残る（PlainSelected）
test("test_plain_selected", async () => {
  // 準備・実行
  const page = await openStory("plain-selected");
  // 検証
  const kept = (await itemsOf(page))
    .filter((item) => !item.dim)
    .map((item) => item.id);
  expect(kept.sort()).toEqual(["root", "a1", "利用者を増やす"].sort());
});

// 補足の layout の色の面と閉じた状態（Colored）
test("test_colored", async () => {
  // 準備・実行
  const page = await openStory("colored");
  // 検証
  const purpose = page.locator('[data-node="a1"]');
  await expect(purpose.getAttribute("class")).resolves.toContain(
    "map-mindmap-filled",
  );
  await expect(purpose.getAttribute("style")).resolves.toContain("purple");
  await expect(
    page.locator('[data-mindmap-toggle="予算"]').getAttribute("aria-expanded"),
  ).resolves.toBe("false");
});

// 案内の手順 2: 「体制」の中で「人手が足りない」とそこまでの道筋のほかが薄い（Walked）
test("test_walked", async () => {
  // 準備・実行
  const page = await openStory("walked");
  // 検証
  const items = await itemsOf(page);
  const dimmed = items.filter((item) => item.dim).map((item) => item.id);
  expect(dimmed).toEqual(["担当の割り当て"]);
});

// ヒントをオフにすると、説明のマーカーが無い（HintsOff）
test("test_hints_off", async () => {
  // 準備・実行
  const page = await openStory("hints-off");
  // 検証
  await expect(
    page.locator(".mdmark-diagram-stage .mdmark-diagram-info").count(),
  ).resolves.toBe(0);
  await expect(page.locator(".map-mindmap-item").count()).resolves.toBe(14);
});

// 幅 390px の置き場所では、等倍のまま表示する枠の中で横にスクロールし、ページははみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openStory("narrow", { width: 390, height: 844 });
  // 検証
  const viewport = await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
  expect(viewport.scroll).toBeGreaterThan(viewport.client);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 項目の押せる要素は名前と役割を持ち、項目の中にフォーカスできる要素を入れ子にしない（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  const hit = page.locator('[data-node="体制"] > .mdmark-diagram-node-hit');
  await expect(hit.getAttribute("role")).resolves.toBe("button");
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(hit.getAttribute("aria-roledescription")).resolves.toBe("項目");
  await expect(hit.getAttribute("aria-label")).resolves.toBe("体制");
  await expect(
    page.locator(".mdmark-diagram-node-hit :is(button, [tabindex])").count(),
  ).resolves.toBe(0);
  await expect(
    page.locator('[data-mindmap-enter="体制"]').getAttribute("aria-label"),
  ).resolves.toBe("体制の中へ入る");
  await expect(
    page.locator("path.map-mindmap-branch").first().getAttribute("aria-hidden"),
  ).resolves.toBe("true");
});

// 項目の文字と形状の指定の無い項目の枠線、ポインターを重ねた項目と選んだ項目の面（Default・Selected）
test("test_item_appearance", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証: 名前は 13px・400、根の名前は 15px・600、名前の文字の上のポインターは pointer
  const fontOf = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        size: style.fontSize,
        weight: style.fontWeight,
        cursor: style.cursor,
      };
    });
  await expect(
    fontOf('[data-node="体制"] .mdmark-diagram-node-name'),
  ).resolves.toEqual({ size: "13px", weight: "400", cursor: "pointer" });
  const root = await fontOf(".map-mindmap-root .mdmark-diagram-node-name");
  expect(root.size).toBe("15px");
  expect(root.weight).toBe("600");
  // 検証: 形状の指定の無い項目は枝の色の 1px の枠線を持つ角の丸い四角
  const plain = await page
    .locator('.map-mindmap-item[data-node="利用者を増やす"]')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        top: style.borderTopStyle,
        width: style.borderTopWidth,
        radius: style.borderTopLeftRadius,
      };
    });
  expect(plain).toEqual({ top: "solid", width: "1px", radius: "6px" });
  // 検証: ポインターを重ねた項目は面の色が変わる
  const item = page.locator('.map-mindmap-item[data-node="予算"]');
  const backgroundOf = (target: typeof item) =>
    target.evaluate((element) => getComputedStyle(element).backgroundColor);
  const before = await backgroundOf(item);
  await item.hover();
  const hovered = await backgroundOf(item);
  expect(hovered).not.toBe(before);
  // 検証: 選んだ項目は、選んでいない同じ枝の項目と面の色が違う
  const selected = await openStory("selected");
  const chosen = await selected
    .locator('.map-mindmap-item[data-node="体制"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const unselected = await selected
    .locator('.map-mindmap-item[data-node="人手が足りない"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(chosen).not.toBe(unselected);
});

// 名前の文字の上を押しても項目を選ぶ（Default）
test("test_select_on_name", async () => {
  // 準備
  const page = await openStory("default");
  // 実行
  await page
    .locator('[data-node="利用者を増やす"] .mdmark-diagram-node-name')
    .click();
  // 検証
  await expect(
    page
      .locator('[data-node="利用者を増やす"] > .mdmark-diagram-node-hit')
      .getAttribute("aria-label"),
  ).resolves.toBe("利用者を増やす（選択中）");
  const kept = (await itemsOf(page))
    .filter((item) => !item.dim)
    .map((item) => item.id);
  expect(kept.sort()).toEqual(["root", "a1", "利用者を増やす"].sort());
});
