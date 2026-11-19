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
  return holder.openStory(`parts-mapc4--${id}`, viewport);
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

// 要素の種類の行・説明・外部の要素の灰色の面・破線の境界を描き、ノードが重ならない（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  await expectNoOverlap(page);
  await expect(
    page.locator('[data-node="support"] .mdmark-diagram-node-kind').innerText(),
  ).resolves.toContain("[External Person]");
  await expect(
    page.locator('[data-node="store"] .map-c4-description').innerText(),
  ).resolves.toBe("注文と支払いを受け付ける");
  const backgrounds = await page
    .locator('[data-node="pay"], [data-node="store"]')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundColor),
    );
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
  for (const [id, title] of [
    ["company", "自社［Enterprise］"],
    ["shop", "通販［Software System］"],
  ] as const) {
    const group = page.locator(`.map-group[data-group="${id}"]`);
    await expect(group.innerText()).resolves.toContain(title);
    await expect(
      group.evaluate((element) => getComputedStyle(element).borderTopStyle),
    ).resolves.toBe("dashed");
  }
});

// コンテナ図は、種類の行に技術を出し、Container_Boundary を「{名前}［Container］」の破線の枠にする（Container）
test("test_container", async () => {
  // 準備・実行
  const page = await openStory("container");
  // 検証
  await expectNoOverlap(page);
  await expect(
    page.locator('[data-node="api"] .mdmark-diagram-node-kind').innerText(),
  ).resolves.toContain("[Container: Node.js]");
  await expect(
    page.locator('[data-node="mail"] .mdmark-diagram-node-kind').innerText(),
  ).resolves.toContain("[External Container: SendGrid]");
  const shop = page.locator('.map-group[data-group="shop"]');
  await expect(shop.innerText()).resolves.toContain(
    "注文のシステム［Container］",
  );
  await expect(
    shop.evaluate((element) => getComputedStyle(element).borderTopStyle),
  ).resolves.toBe("dashed");
});

// コンポーネント図は、種類の行を [Component: {技術}] にする（Component）
test("test_component", async () => {
  // 準備・実行
  const page = await openStory("component");
  // 検証
  await expectNoOverlap(page);
  await expect(
    page.locator('[data-node="router"] .mdmark-diagram-node-kind').innerText(),
  ).resolves.toContain("[Component: Express]");
  await expect(
    page.locator('[data-node="pay"] .mdmark-diagram-node-kind').innerText(),
  ).resolves.toContain("[External Component: Stripe]");
});

// 動的図は、関係のラベルの前に記載の順の番号を出し、RelIndex の第 1 引数を番号にしない（Dynamic）
test("test_dynamic", async () => {
  // 準備・実行
  const page = await openStory("dynamic");
  // 検証
  const labels = await page
    .locator(".mdmark-diagram-label[data-wire]")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => [
          element.getAttribute("data-wire"),
          element.textContent?.trim(),
        ]),
      ),
    );
  expect(labels.r1).toBe("1: 注文を入力する");
  expect(labels.r3).toBe("3: 注文を保存する [SQL]");
});

// 配置図は、配置先のノードを「{名前}［{種類}］」の実線の枠にして入れ子にし、Node_L を Node_R の左に置く（Deployment）
test("test_deployment", async () => {
  // 準備・実行
  const page = await openStory("deployment");
  // 検証
  await expectNoOverlap(page);
  const cloud = page.locator('.map-group[data-group="cloud"]');
  await expect(cloud.innerText()).resolves.toContain("クラウド［AWS］");
  await expect(
    cloud.evaluate((element) => getComputedStyle(element).borderTopStyle),
  ).resolves.toBe("solid");
  const rect = (id: string) =>
    page
      .locator(`.map-group[data-group="${id}"]`)
      .evaluate((element) => element.getBoundingClientRect().toJSON());
  const [outer, inner, app, db] = await Promise.all([
    rect("cloud"),
    rect("region"),
    rect("app"),
    rect("dbnode"),
  ]);
  expect(inner.left).toBeGreaterThanOrEqual(outer.left);
  expect(inner.right).toBeLessThanOrEqual(outer.right);
  expect(app.right).toBeLessThanOrEqual(db.left);
});

// 配置先のノード「東京のリージョン」を閉じると、名前の行の下に「要素 2 件」の行を持つ 1 つのノードになる（DeploymentCollapsed）
test("test_deployment_collapsed", async () => {
  // 準備・実行
  const page = await openStory("deployment-collapsed");
  // 検証
  await expectCountBelowTitle(
    page,
    '.map-closed-group[data-group="region"]',
    "要素 2 件",
  );
  await expect(
    page.locator('.map-group[data-group="cloud"]').count(),
  ).resolves.toBe(1);
});

// 境界「通販」を閉じると、名前の行の下に「要素 3 件」の行を持つ 1 つのノードになり、タイトルが収まる（BoundaryCollapsed）
test("test_boundary_collapsed", async () => {
  // 準備・実行
  const page = await openStory("boundary-collapsed");
  // 検証
  const closed = page.locator('.map-closed-group[data-group="shop"]');
  await expectCountBelowTitle(
    page,
    '.map-closed-group[data-group="shop"]',
    "要素 3 件",
  );
  const size = await closed.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
});

// 境界「通販」の中へ入ると、外の要素が薄い（Entered）
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
  expect(shown.sort()).toEqual(["store", "stock", "orders"].sort());
});

// 「注文のシステム」と「在庫のシステム」を選ぶと、Rel_R の線と両端のほかが薄い（ElementSelected）
test("test_element_selected", async () => {
  // 準備・実行
  const page = await openStory("element-selected");
  // 検証
  const marks = await dimsOf(page);
  for (const id of ["store", "stock", "r3"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["customer", "orders", "pay", "r1", "r2"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
});

// 幅 390px の置き場所（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openStory("narrow", { width: 390, height: 844 });
  // 検証
  await expectNarrow(page);
});

// 要素はフォーカスを受け、外部の要素は種類の行の External でも伝える（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  const hit = page.locator(
    '.mdmark-diagram-node[data-node="store"] > .mdmark-diagram-node-hit',
  );
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(hit.getAttribute("aria-label")).resolves.toBe("注文のシステム");
  await expect(
    page.locator('[data-node="pay"]').innerText(),
  ).resolves.toContain("External");
});

/** データの印を流す線と、両方へ流すか */
function packetsOf(page: Page) {
  return page.locator(".map-packet").evaluateAll((elements) =>
    elements.map((element) => ({
      wire: element.getAttribute("data-wire") ?? "",
      backward:
        element.querySelector("animateMotion")?.getAttribute("keyPoints") ===
        "1;0",
    })),
  );
}

// C4Dynamic の 2 本目の関係の再生（DynamicPlaying）
test("test_dynamic_playing", async () => {
  // 準備・実行
  const page = await openStory("dynamic-playing");
  // 検証
  const marks = await dimsOf(page);
  for (const id of ["web", "api", "r2"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["customer", "r1", "r3", "r5"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
  const packets = await packetsOf(page);
  expect(packets.length).toBeGreaterThan(0);
  expect(packets.every((packet) => packet.wire === "r2")).toBe(true);
  expect(packets.some((packet) => packet.backward)).toBe(false);
});

// C4Dynamic の閉じた境界の中の要素への関係の再生（DynamicPlayingBoundary）
test("test_dynamic_playing_boundary", async () => {
  // 準備・実行
  const page = await openStory("dynamic-playing-boundary");
  // 検証
  const store = page.locator('.map-closed-group[data-group="store"]');
  await expect(
    store.evaluate((element) => element.classList.contains("map-dim")),
  ).resolves.toBe(false);
  const marks = await dimsOf(page);
  for (const id of ["api", "api->store"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["customer", "web", "r2"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
  const packets = await packetsOf(page);
  expect(packets.length).toBeGreaterThan(0);
  expect(packets.every((packet) => packet.wire === "api->store")).toBe(true);
});

// C4Dynamic の両向きの関係の再生（DynamicPlayingBiRel）
test("test_dynamic_playing_bi_rel", async () => {
  // 準備・実行
  const page = await openStory("dynamic-playing-bi-rel");
  // 検証
  const marks = await dimsOf(page);
  for (const id of ["web", "customer", "r5"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["api", "r1"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
  const packets = await packetsOf(page);
  expect(packets.every((packet) => packet.wire === "r5")).toBe(true);
  expect(packets.some((packet) => packet.backward)).toBe(true);
  expect(packets.some((packet) => !packet.backward)).toBe(true);
});
