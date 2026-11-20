import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  type Box,
  createBrowserHolder,
  expectCountBelowTitle,
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
  return holder.openStory(`parts-mapclass--${id}`, viewport);
}

/** 要素の矩形（ページの座標） */
function rectOf(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
    };
  });
}

/** ノードと線の、薄くしたか */
function dimsOf(page: Page) {
  return page
    .locator(
      ".mdmark-diagram-stage :is(.mdmark-diagram-node[data-node], path.mdmark-diagram-wire[data-wire])",
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id:
          element.getAttribute("data-node") ??
          element.getAttribute("data-wire") ??
          "",
        dim: element.classList.contains("map-dim"),
      })),
    );
}

/** 表示しているノードのうち、どの 2 つも重ならないことを確かめる */
async function expectNoOverlap(page: Page): Promise<void> {
  const boxes = await page
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          id: element.getAttribute("data-node") ?? "",
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
        };
      }),
    );
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
}

/** 幅 390px の置き場所では、表示する枠の中で横にスクロールし、ページははみ出さない */
async function expectNarrow(page: Page): Promise<void> {
  const viewport = await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
  expect(viewport.scroll).toBeGreaterThan(viewport.client);
  await expect(pageOverflows(page)).resolves.toBe(false);
}

// クラスのメンバーの区画・注釈・関係の端の形と多重度・namespace・ノートを描き、ノードが重ならない（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  await expectNoOverlap(page);
  await expect(
    page.locator('[data-node="図形"] .map-class-annotation').innerText(),
  ).resolves.toBe("«interface»");
  await expect(
    page
      .locator('[data-node="基本図形"] .map-class-members[role="list"]')
      .count(),
  ).resolves.toBe(2);
  await expect(
    page.locator(".map-class-ends [data-end-shape]").count(),
  ).resolves.toBe(6);
  await expect(page.locator(".map-class-card").count()).resolves.toBe(2);
  await expect(
    page.locator('[data-node="note_1"] .mdmark-diagram-node-kind').innerText(),
  ).resolves.toContain("ノート");
  const group = await rectOf(page, '.map-group[data-group="形状"]');
  for (const id of ["図形", "基本図形", "円"]) {
    const box = await rectOf(page, `[data-node="${id}"]`);
    expect(box.left >= group.left && box.right <= group.right, id).toBe(true);
  }
});

// 「基本図形」のメンバーを閉じると、名前と山形だけの開閉のボタンの 1 行になる（MembersCollapsed）
test("test_members_collapsed", async () => {
  // 準備・実行
  const page = await openStory("members-collapsed");
  // 検証
  const toggle = page.locator('[data-node="基本図形"] button.map-class-toggle');
  await expect(toggle.innerText()).resolves.toBe("");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(
    page.locator('[data-node="基本図形"] .map-class-member').count(),
  ).resolves.toBe(0);
});

// namespace「形状」の中へ入ると、外のクラスが薄い（Entered）
test("test_entered", async () => {
  // 準備・実行
  const page = await openStory("entered");
  // 検証
  const shown = await page
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      elements
        .filter((element) => !element.classList.contains("map-faded"))
        .map((element) => element.getAttribute("data-node")),
    );
  expect(shown.sort()).toEqual(["図形", "基本図形", "円"].sort());
});

// namespace「形状」を閉じると、名前の行の下に「クラス 3 件」の行を持つ 1 つのノードになる（NamespaceCollapsed）
test("test_namespace_collapsed", async () => {
  // 準備・実行
  const page = await openStory("namespace-collapsed");
  // 検証
  await expectCountBelowTitle(
    page,
    '.map-closed-group[data-group="形状"]',
    "クラス 3 件",
  );
});

// 「図面」と「円」を選ぶと、2 本の最短の経路のクラスと関係のほかが薄い（PathSelected）
test("test_path_selected", async () => {
  // 準備・実行
  const page = await openStory("path-selected");
  // 検証
  const marks = await dimsOf(page);
  for (const id of ["図面", "円", "基本図形", "一覧", "r2", "r3", "r4", "r7"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["描画器", "図形", "r1", "r5", "r6"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
});

// ヒントをオフにすると、説明のマーカーとメンバーの説明のボタンが無い（HintsOff）
test("test_hints_off", async () => {
  // 準備・実行
  const page = await openStory("hints-off");
  // 検証
  await expect(page.locator("button.map-class-note").count()).resolves.toBe(0);
  await expect(
    page.locator(".mdmark-diagram-stage .mdmark-diagram-info").count(),
  ).resolves.toBe(0);
  await expect(
    page.locator('[data-node="基本図形"] .map-class-member').count(),
  ).resolves.toBe(3);
});

// 幅 390px の置き場所（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openStory("narrow", { width: 390, height: 844 });
  // 検証
  await expectNarrow(page);
});

// クラスのノード・メンバーの区画・開閉のボタンは、スクリーンリーダー向けの名前と役割を持つ（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  const hit = page.locator(
    '.mdmark-diagram-node[data-node="基本図形"] > .mdmark-diagram-node-hit',
  );
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(hit.getAttribute("aria-label")).resolves.toBe("基本図形");
  await expect(
    page
      .locator('[data-node="基本図形"] .map-class-member[role="listitem"]')
      .count(),
  ).resolves.toBe(3);
  await expect(
    page
      .locator('[data-node="基本図形"] button.map-class-toggle')
      .getAttribute("aria-label"),
  ).resolves.toBe("基本図形のメンバーを閉じる");
  await expect(
    page
      .locator('[data-node="基本図形"] button.map-class-note')
      .getAttribute("aria-label"),
  ).resolves.toBe("描くの説明");
  // メンバーの説明のボタンの上のポインターは、ほかのボタンと同じ pointer（help にしない）
  await expect(
    page
      .locator('[data-node="基本図形"] button.map-class-note')
      .evaluate((button) => getComputedStyle(button).cursor),
  ).resolves.toBe("pointer");
  await expect(
    page.locator(".map-class-ends").getAttribute("aria-hidden"),
  ).resolves.toBe("true");
});

// click・link の行のクラスは、クラスの全体が本文のリンクになる（LinkedClass）
test("test_linked_class", async () => {
  // 準備・実行
  const page = await openStory("linked-class");
  // 検証
  await expect(
    page
      .locator('[data-node="図面"] a.mdmark-diagram-node-link')
      .getAttribute("href"),
  ).resolves.toBe("https://example.com/drawing");
  await expect(
    page.locator("a.mdmark-diagram-node-link").count(),
  ).resolves.toBe(1);
});

/** セレクタに当たる全ての要素の矩形（ページの座標） */
function rectsOf(page: Page, selector: string): Promise<Box[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      };
    }),
  );
}

/** クラスのメンバーの文字が、行とクラスのノードの中に収まる */
async function expectMembersInside(page: Page, id: string): Promise<void> {
  const node = await rectOf(page, `.mdmark-diagram-node[data-node="${id}"]`);
  const rows = await page
    .locator(`[data-node="${id}"] .map-class-member`)
    .evaluateAll((elements) =>
      elements.map((element) => {
        const row = element.getBoundingClientRect();
        const text = (
          element.querySelector(".map-class-text") as HTMLElement
        ).getBoundingClientRect();
        return { row: row.bottom, text: text.bottom, right: text.right };
      }),
    );
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.text).toBeLessThanOrEqual(row.row + 0.5);
    expect(row.text).toBeLessThanOrEqual(node.bottom + 0.5);
    expect(row.right).toBeLessThanOrEqual(node.right + 0.5);
  }
}

// 長いメンバー・型の引数・補足の幅・長いラベルを、クラス・ノート・namespace のタイトルと重ねずに描く（LongMembers）
test("test_long_members", async () => {
  // 準備・実行
  const page = await openStory("long-members");
  // 検証
  await expectNoOverlap(page);
  for (const id of ["検索", "時間範囲", "設定"])
    await expectMembersInside(page, id);
  const texts = await page.locator(".map-class-text").allTextContents();
  expect(texts).toContain("時間範囲(期間) tuple<int, int>");
  expect(texts).toContain("対応: dict<str, list<int>>");
  const setting = await rectOf(page, '.mdmark-diagram-node[data-node="設定"]');
  expect(setting.right - setting.left).toBeCloseTo(320, 0);
  const avoid = [
    ...(await rectsOf(page, ".mdmark-diagram-node[data-node]")),
    ...(await rectsOf(page, '[data-group="変換"] .map-group-head')),
  ];
  const labels = await rectsOf(page, "text.map-class-label");
  expect(labels).toHaveLength(3);
  for (const [i, label] of labels.entries()) {
    for (const other of avoid) expect(overlaps(label, other)).toBe(false);
    for (const other of labels.slice(i + 1))
      expect(overlaps(label, other)).toBe(false);
  }
});
