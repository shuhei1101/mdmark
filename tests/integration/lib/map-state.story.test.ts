import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 状態遷移図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1920, height: 900 };

/** map の状態遷移図のストーリーを開く */
function openState(id: string, viewport = WIDE): Promise<Page> {
  return holder.openStory(`parts-mapstate--${id}`, viewport);
}

type Box = { left: number; top: number; right: number; bottom: number };

/** 辺が接するだけは重ならない扱いで、2 つの矩形が重なるか */
const overlaps = (a: Box, b: Box) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

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

/** 状態のノードと遷移の線の、薄くしたか */
function dimsOf(page: Page) {
  return page
    .locator(
      ".mdmark-diagram-stage :is(.mdmark-diagram-node[data-node], path.mdmark-diagram-wire[data-wire], path.map-state-loop[data-wire])",
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id:
          element.getAttribute("data-node") ??
          element.getAttribute("data-wire") ??
          "",
        dim: element.classList.contains("map-dim"),
        opacity: Number(getComputedStyle(element).opacity),
      })),
    );
}

/** 線の端の点（ページの座標） */
function wireEnd(page: Page, wire: string) {
  return page
    .locator(`path.mdmark-diagram-wire[data-wire="${wire}"]`)
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const svg = path.ownerSVGElement;
      const box = svg?.getBoundingClientRect();
      const scale = box && svg ? box.width / svg.width.baseVal.value : 1;
      const point = path.getPointAtLength(path.getTotalLength());
      return {
        x: (box?.left ?? 0) + point.x * scale,
        y: (box?.top ?? 0) + point.y * scale,
      };
    });
}

// 開始（黒丸）・終了（二重丸）・分岐（ひし形）の形状・入れ子の状態・同じ状態への遷移・注記を描き、ノードとラベルが重ならない（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openState("default");
  // 検証: 開始・終了・分岐の形状。名前と種類の行を出さず、フォーカスを持たない
  const shapes = await page
    .locator(".mdmark-diagram-node[data-shape]")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          id: element.getAttribute("data-node"),
          shape: element.getAttribute("data-shape"),
          label: element.getAttribute("aria-label"),
          tabindex: element.getAttribute("tabindex"),
          width: box.width,
          height: box.height,
          radius: style.borderTopLeftRadius,
          clip: style.clipPath,
          name: getComputedStyle(
            element.querySelector(".mdmark-diagram-node-name") ?? element,
          ).display,
        };
      }),
    );
  const byId = new Map(shapes.map((shape) => [shape.id, shape]));
  for (const id of ["start_root", "start_実行中", "start_保留"]) {
    expect(byId.get(id), id).toMatchObject({
      shape: "start",
      label: "開始",
      tabindex: null,
      name: "none",
    });
  }
  for (const id of ["end_root", "end_実行中", "end_保留"])
    expect(byId.get(id), id).toMatchObject({ shape: "end", label: "終了" });
  const start = byId.get("start_root");
  expect(start?.width).toBeCloseTo(start?.height ?? 0, 0);
  expect(start?.radius).toBe("50%");
  const end = byId.get("end_root");
  expect(end?.width).toBeCloseTo(end?.height ?? 0, 0);
  expect(byId.get("判定")).toMatchObject({ shape: "choice", label: "分岐" });
  expect(byId.get("判定")?.clip).toContain("polygon");
  // 検証: as で付けた名前と、注記の種類の行
  await expect(
    page
      .locator('.mdmark-diagram-node[data-node="s1"] .mdmark-diagram-node-name')
      .innerText(),
  ).resolves.toBe("差し戻しの理由を確認する");
  await expect(
    page
      .locator('.mdmark-diagram-node[data-node="n1"] .mdmark-diagram-node-kind')
      .innerText(),
  ).resolves.toBe("ノート");
  await expect(
    page
      .locator('path.mdmark-diagram-wire[data-wire="n1"]')
      .getAttribute("stroke-dasharray"),
  ).resolves.toBeTruthy();
  const note = await rectOf(page, '.mdmark-diagram-node[data-node="n1"]');
  const waiting = await rectOf(
    page,
    '.mdmark-diagram-node[data-node="確認待ち"]',
  );
  expect(note.left).toBeGreaterThanOrEqual(waiting.right);
  // 検証: 「判定」→「実行中」の線（t5）の先が、「実行中」の中の開始のノード
  const inner = await rectOf(
    page,
    '.mdmark-diagram-node[data-node="start_実行中"]',
  );
  const t5 = await wireEnd(page, "t5");
  expect(t5.x).toBeGreaterThanOrEqual(inner.left - 1);
  expect(t5.x).toBeLessThanOrEqual(inner.right + 1);
  expect(t5.y).toBeGreaterThanOrEqual(inner.top - 1);
  expect(t5.y).toBeLessThanOrEqual(inner.bottom + 1);
  // 検証: 同じ状態への遷移の線とラベル。ほかのラベル・ノードと重ならない
  await expect(
    page.locator('[data-loop="t2"] .map-state-loop-label').textContent(),
  ).resolves.toBe("保存する");
  const loopLabel = await rectOf(
    page,
    '[data-loop="t2"] .map-state-loop-label',
  );
  const labels = await page
    .locator(".mdmark-diagram-label")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          id: element.textContent ?? "",
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
        };
      }),
    );
  for (const label of labels)
    expect(overlaps(loopLabel, label), label.id).toBe(false);
  const nodes = await page
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
  for (const node of nodes)
    expect(overlaps(loopLabel, node), node.id).toBe(false);
  for (const [i, a] of nodes.entries())
    for (const b of nodes.slice(i + 1))
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 再生の 6 本目。その遷移と両端の状態のほかが薄く、その線の上をデータのマーカーが流れる（Playing）
test("test_playing", async () => {
  // 準備・実行
  const page = await openState("playing");
  // 検証
  const kept = new Set(["判定", "s1", "t6"]);
  for (const mark of await dimsOf(page)) {
    expect(mark.dim, mark.id).toBe(!kept.has(mark.id));
    if (mark.dim) expect(mark.opacity, mark.id).toBeCloseTo(0.25, 2);
  }
});

// 再生の 2 本目（同じ状態への遷移）。状態から出て戻る線が太く強調される（SelfTransitionPlaying）
test("test_self_transition_playing", async () => {
  // 準備・実行
  const page = await openState("self-transition-playing");
  // 検証
  const loop = page.locator('[data-loop="t2"] path.map-state-loop');
  await expect(loop.getAttribute("class")).resolves.toContain("is-active");
  const width = await loop.evaluate(
    (element) => getComputedStyle(element).strokeWidth,
  );
  expect(Number.parseFloat(width)).toBeGreaterThan(2);
  const marks = await dimsOf(page);
  expect(marks.find((mark) => mark.id === "下書き")?.dim).toBe(false);
  expect(marks.find((mark) => mark.id === "確認待ち")?.dim).toBe(true);
});

// 「確認待ち」を選ぶと、入る遷移 2 本・出る遷移 2 本と相手の状態のほかが薄い（StateSelected）
test("test_state_selected", async () => {
  // 準備・実行
  const page = await openState("state-selected");
  // 検証
  const marks = await dimsOf(page);
  for (const id of ["確認待ち", "t3", "t4", "t12", "t13"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["完了", "処理", "t9"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
  await expect(
    page
      .locator('.mdmark-diagram-node[data-node="確認待ち"]')
      .getAttribute("aria-label"),
  ).resolves.toBe("確認待ち（選択中）");
});

// 「実行中」の中へ入ると、外の状態が薄い（Entered）
test("test_entered", async () => {
  // 準備・実行
  const page = await openState("entered");
  // 検証
  const faded = await page
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      elements
        .filter((element) => !element.classList.contains("map-faded"))
        .map((element) => element.getAttribute("data-node")),
    );
  expect(faded.sort()).toEqual(
    ["start_実行中", "準備", "処理", "end_実行中"].sort(),
  );
  await expect(
    page.locator(".map-group-title.is-current").innerText(),
  ).resolves.toBe("実行中");
});

// 「実行中」を閉じると、「状態 2 件」を持つ 1 つのノードになる（Collapsed）
test("test_collapsed", async () => {
  // 準備・実行
  const page = await openState("collapsed");
  // 検証
  await expect(
    page.locator('.map-closed-group[data-group="実行中"]').innerText(),
  ).resolves.toContain("状態 2 件");
});

// 幅 390px の置き場所では、倍率 1 のまま表示する枠の中で横にスクロールし、ページははみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openState("narrow", { width: 390, height: 844 });
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

// 状態のノードと同じ状態への遷移の押せる帯は、スクリーンリーダー向けの名前を持つ（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openState("default");
  // 検証
  const node = page.locator('.mdmark-diagram-node[data-node="確認待ち"]');
  await expect(node.getAttribute("tabindex")).resolves.toBe("0");
  await expect(node.getAttribute("aria-label")).resolves.toBe("確認待ち");
  const hit = page.locator('[data-loop="t2"] .map-wire-hit');
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(hit.getAttribute("aria-label")).resolves.toContain("保存する");
  await expect(
    page
      .locator('.mdmark-diagram-node[data-node="n1"]')
      .getAttribute("aria-hidden"),
  ).resolves.toBeNull();
});
