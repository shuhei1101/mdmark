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

// 判定フローチャートは種類ごとの形のノードで描き、凡例は 2 種類以上あるノードの種類だけで、1 種類の線を載せない（Judgement）
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

// 座標を省いた判定フローチャートを、質問を左の列に、右へ出す線の先を同じ行の右の列に置いて描く（JudgementAuto）
test("test_judgement_auto", async () => {
  // 準備・実行
  const page = await openFlow("judgement-auto");
  // 検証
  const nodes = await nodeBoxes(page);
  const box = (id: string) => {
    const found = nodes.find((node) => node.id === id);
    if (found === undefined) {
      throw new Error(`ノードが無い: ${id}`);
    }
    return found.box;
  };
  expect(nodes).toHaveLength(6);
  const centerX = (id: string) => (box(id).left + box(id).right) / 2;
  const centerY = (id: string) => (box(id).top + box(id).bottom) / 2;
  for (const id of ["q1", "q2", "r2"]) {
    expect(centerX(id)).toBeCloseTo(centerX("start"), 0);
  }
  expect(box("start").bottom).toBeLessThan(box("q1").top);
  expect(box("q1").bottom).toBeLessThan(box("q2").top);
  expect(box("a1").left).toBeGreaterThan(box("q1").right);
  expect(centerY("a1")).toBeCloseTo(centerY("q1"), 0);
  expect(box("r1").left).toBeGreaterThan(box("q2").right);
  expect(centerY("r1")).toBeCloseTo(centerY("q2"), 0);
  const labels = await page.locator(".mdmark-diagram-label").allInnerTexts();
  expect(labels.filter((text) => text.trim() === "YES")).toHaveLength(2);
  expect(labels.filter((text) => text.trim() === "NO")).toHaveLength(2);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** リンク先を持つノードの、リンク・名前の色と下線・`has-link` を `data-node` ごとに返す */
function linkStates(page: Page) {
  return page.locator(".mdmark-diagram-node").evaluateAll((nodes) =>
    Object.fromEntries(
      nodes.map((node) => {
        const link = node.querySelector<HTMLAnchorElement>(
          "a.mdmark-diagram-node-link",
        );
        const name = node.querySelector(".mdmark-diagram-node-name");
        const style = name ? getComputedStyle(name) : undefined;
        return [
          node.getAttribute("data-node") ?? "",
          {
            hasLink: node.classList.contains("has-link"),
            href: link?.getAttribute("href") ?? null,
            label: link?.getAttribute("aria-label") ?? null,
            underline: style?.textDecorationLine ?? "",
            color: style?.color ?? "",
            background: getComputedStyle(node).backgroundColor,
            outline: link ? getComputedStyle(link).outlineStyle : "",
          },
        ];
      }),
    ),
  );
}

// リンク先を持つノードの名前を本文のリンクと同じ色と下線にし、io の印をリンクの上に重ねる（LinkedNodes）
test("test_linked_nodes", async () => {
  // 準備・実行
  const page = await openFlow("linked-nodes");
  // 検証
  const states = await linkStates(page);
  expect(states.recv).toMatchObject({
    hasLink: true,
    href: "https://example.com/spec",
    label: "問い合わせを受け取る",
    underline: "underline",
  });
  expect(states.classify).toMatchObject({
    hasLink: true,
    href: "./other.md",
    label: "分類する",
    underline: "underline",
  });
  expect(states.store).toMatchObject({ hasLink: false, href: null });
  expect(states.store?.underline).toBe("none");
  expect(states.recv?.color).not.toBe(states.store?.color);
  const stacked = await page
    .locator('[data-node="classify"]')
    .evaluate((node) => {
      const info = node.querySelector(".mdmark-diagram-info");
      const link = node.querySelector(".mdmark-diagram-node-link");
      if (!info || !link) {
        return false;
      }
      const rect = info.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return info.contains(top);
    });
  expect(stacked).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// リンク先を持つノードのホバーでノードの地に種類の色を敷き、フォーカスでノードの外側に枠を出す（LinkedNodeHoverFocus）
test("test_linked_node_hover_focus", async () => {
  // 準備・実行
  const page = await openFlow("linked-node-hover-focus");
  // 検証
  const states = await linkStates(page);
  expect(states.recv?.background).not.toBe(states.store?.background);
  expect(states.classify?.outline).toBe("solid");
  expect(states.recv?.outline).not.toBe("solid");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 許さないリンク先を持つノードはリンクにせず、図の前に書き方の警告を置く（LinkNotAllowed）
test("test_link_not_allowed", async () => {
  // 準備・実行
  const page = await openFlow("link-not-allowed");
  // 検証
  const warning = await page.locator(".mdmark-syntax-warning").innerText();
  for (const word of [
    "recv",
    "javascript:alert(1)",
    "classify",
    "id:spec#items",
  ]) {
    expect(warning).toContain(word);
  }
  await expect(
    page.locator("a.mdmark-diagram-node-link").count(),
  ).resolves.toBe(0);
  const order = await page
    .locator("#storybook-root .mdmark")
    .evaluate((root) => {
      const warningAt = root.querySelector(".mdmark-syntax-warning");
      const figure = root.querySelector("figure.mdmark-diagram");
      return warningAt && figure
        ? warningAt.compareDocumentPosition(figure) &
            Node.DOCUMENT_POSITION_FOLLOWING
        : 0;
    });
  expect(order).not.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// システムの枠と LLM の層の hint は、タイトルの右に箱と同じ情報の印を置き、hint を持たない層には置かない。凡例は 2 種類以上ある箱と線の種類だけ（GroupHints）
test("test_group_hints", async () => {
  // 準備・実行
  const page = await openFlow("group-hints");
  // 検証
  const marks = page.locator("button.mdmark-diagram-group-info");
  await expect(marks.count()).resolves.toBe(2);
  await expect(
    page
      .locator(".mdmark-diagram-frame-title button.mdmark-diagram-group-info")
      .count(),
  ).resolves.toBe(1);
  const lanes = await page
    .locator(".mdmark-diagram-lane-label")
    .evaluateAll((labels) =>
      labels.map(
        (label) => label.querySelector(".mdmark-diagram-group-info") !== null,
      ),
    );
  expect(lanes.filter(Boolean)).toHaveLength(1);
  const markSize = await marks.first().boundingBox();
  const nodeMark = await page
    .locator(".mdmark-diagram-node .mdmark-diagram-info")
    .first()
    .boundingBox();
  expect(
    Math.abs((markSize?.width ?? 0) - (nodeMark?.width ?? 0)),
  ).toBeLessThanOrEqual(6);
  const legend = (
    await page.locator(".mdmark-diagram-legend li").allInnerTexts()
  ).map((text) => text.trim());
  for (const word of ["システムの枠", "層", "交差", "出る", "下線"]) {
    expect(
      legend.some((text) => text.includes(word)),
      word,
    ).toBe(false);
  }
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 拡大して処理の層の途中を見せた状態は、システムの枠と層のタイトルを地の色と線の札で、ノードと線より手前に留める（TitlesStuck）
test("test_titles_stuck", async () => {
  // 準備・実行
  const page = await openFlow("titles-stuck");
  // 検証
  const titles = await page
    .locator(
      ":is(.mdmark-diagram-frame-title, .mdmark-diagram-lane-label).is-stuck",
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return {
          background: style.backgroundColor,
          border: style.borderTopStyle,
          zIndex: style.zIndex,
          front: hit !== null && (hit === element || element.contains(hit)),
          visible: rect.width > 0 && rect.height > 0,
        };
      }),
    );
  expect(titles.length).toBeGreaterThanOrEqual(2);
  for (const title of titles.filter((entry) => entry.visible)) {
    expect(title.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(title.border).toBe("solid");
    expect(Number(title.zIndex)).toBeGreaterThanOrEqual(2);
  }
  expect(titles.some((entry) => entry.visible && entry.front)).toBe(true);
});
