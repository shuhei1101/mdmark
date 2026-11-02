import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 全体が収まる倍率になるまで待って、フロー図のストーリーを開く */
async function openFlow(id: string): Promise<Page> {
  const page = await holder.openStory(`parts-flowdiagram--${id}`);
  await page.waitForFunction(() =>
    (
      document.querySelector<HTMLElement>(".mdmark-diagram-stage")?.style
        .transform ?? ""
    ).startsWith("scale("),
  );
  return page;
}

// 枠と 3 つの層・ノード・5 種の線・交差・ループの戻りを描く（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openFlow("default");
  // 検証
  await expect(page.locator(".mdmark-diagram-lane").count()).resolves.toBe(3);
  await expect(page.locator(".mdmark-diagram-node").count()).resolves.toBe(9);
  await expect(
    page.locator(".mdmark-diagram-wires path.mdmark-diagram-wire").count(),
  ).resolves.toBe(10);
  await expect(
    page.locator('.mdmark-diagram-wires path[data-line="loop"]').count(),
  ).resolves.toBe(1);
  const arcs = await page
    .locator('.mdmark-diagram-wires path[data-line="flow"]')
    .evaluateAll(
      (paths) =>
        paths.filter((path) =>
          (path.getAttribute("d") ?? "").includes(" A6,6 "),
        ).length,
    );
  expect(arcs).toBeGreaterThanOrEqual(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 長い題とノードの名前は、題を折り返し、ノードの中で折り返してノードから出ない（LongNames）
test("test_long_names", async () => {
  // 準備・実行
  const page = await openFlow("long-names");
  // 検証
  const inside = await page
    .locator(".mdmark-diagram-node")
    .evaluateAll((nodes) =>
      nodes.every((node) => {
        const box = node.getBoundingClientRect();
        const name = node
          .querySelector(".mdmark-diagram-node-name")
          ?.getBoundingClientRect();
        return name
          ? name.right <= box.right + 1 && name.left >= box.left - 1
          : false;
      }),
    );
  expect(inside).toBe(true);
  const title = await page
    .locator(".mdmark-diagram-title")
    .evaluate((element) => element.getBoundingClientRect().right);
  expect(title).toBeLessThanOrEqual(420);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** ノードごとの、種類・ノードと名前の矩形・computed の角の丸み・菱形の有無 */
function nodeBoxes(page: Page) {
  return page.locator(".mdmark-diagram-node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const name = node
        .querySelector(".mdmark-diagram-node-name")
        ?.getBoundingClientRect();
      return {
        id: node.getAttribute("data-node") ?? "",
        kind: node.getAttribute("data-kind") ?? "",
        box: {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
        },
        name: name
          ? {
              left: name.left,
              top: name.top,
              right: name.right,
              bottom: name.bottom,
            }
          : undefined,
        radius: getComputedStyle(node).borderTopLeftRadius,
        diamond: node.querySelector(":scope > svg polygon") !== null,
      };
    }),
  );
}

// 判定フローチャートは種類ごとの形のノードで描き、凡例の種類は開始・質問・アクション・結果だけ（Judgement）
test("test_judgement", async () => {
  // 準備・実行
  const page = await openFlow("judgement");
  // 検証
  const nodes = await nodeBoxes(page);
  const ofKind = (kind: string) => nodes.filter((node) => node.kind === kind);
  expect(
    ["start", "question", "action", "result"].map(
      (kind) => ofKind(kind).length,
    ),
  ).toEqual([1, 2, 1, 2]);
  expect(ofKind("start").every((node) => node.radius === "50%")).toBe(true);
  expect(ofKind("action").every((node) => node.radius === "2px")).toBe(true);
  expect(ofKind("result").every((node) => node.radius === "999px")).toBe(true);
  expect(nodes.filter((node) => node.diamond).map((node) => node.kind)).toEqual(
    ["question", "question"],
  );
  const legend = await page
    .locator(".mdmark-diagram-legend li")
    .allInnerTexts();
  expect(legend.map((text) => text.trim())).toEqual([
    "開始",
    "質問",
    "アクション",
    "結果",
    "処理の流れ",
  ]);
  const labels = await page.locator(".mdmark-diagram-label").allInnerTexts();
  expect([...new Set(labels)].sort()).toEqual(["NO", "YES"]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 長い文は、質問の名前を菱形の中央の四角に、ほかの名前をノードの中に収める（JudgementLong）
test("test_judgement_long", async () => {
  // 準備・実行
  const page = await openFlow("judgement-long");
  // 検証
  const nodes = await nodeBoxes(page);
  for (const node of nodes) {
    const { box, name } = node;
    if (!name) {
      throw new Error(`ノード ${node.id} に名前が無い`);
    }
    // 質問は菱形に内接する中央の四角（上下に高さの 1/4、左右に幅の 1/4 の余白）に収める
    const inset =
      node.kind === "question"
        ? { x: (box.right - box.left) / 4, y: (box.bottom - box.top) / 4 }
        : { x: 0, y: 0 };
    expect(name.left).toBeGreaterThanOrEqual(box.left + inset.x - 1);
    expect(name.right).toBeLessThanOrEqual(box.right - inset.x + 1);
    expect(name.bottom).toBeLessThanOrEqual(box.bottom - inset.y + 1);
  }
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 知らない種類のノードは、追加した 4 種類を含む 10 種類を使える種類に並べた書き方の警告にする（UnknownKind）
test("test_unknown_kind", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-flowdiagram--unknown-kind");
  // 検証
  await expect(
    page.locator(".mdmark-syntax-warning").innerText(),
  ).resolves.toContain(
    "ノード「分類」の種類 robot は使えません。使える種類は llm・dm・script・mcp・data・external・start・question・action・result です",
  );
  await expect(page.locator("figure.mdmark-diagram").count()).resolves.toBe(0);
});

// 定義を読めないときは、図の代わりに書き方の警告を出す（Invalid）
test("test_invalid", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-flowdiagram--invalid");
  // 検証
  await expect(
    page.locator(".mdmark-syntax-warning").innerText(),
  ).resolves.toContain("フロー図の部品の定義を JSON として読めません");
  await expect(page.locator("figure.mdmark-diagram").count()).resolves.toBe(0);
});
