import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  contrastRatio,
  createBrowserHolder,
  pageOverflows,
  resolveColorIn,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 構成図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1920, height: 720 };

/** map の構成図のストーリーを開く */
function openMap(id: string, viewport = WIDE): Promise<Page> {
  return holder.openStory(`parts-mapflow--${id}`, viewport);
}

/** ノード・線・グループの要素の、薄くしたか・強調したか・選んだか */
function marksOf(page: Page) {
  return page
    .locator(
      ".mdmark-diagram-stage :is([data-node], path.mdmark-diagram-wire[data-wire], .map-group[data-group], .map-closed-group[data-group])",
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id:
          element.getAttribute("data-node") ??
          element.getAttribute("data-wire") ??
          element.getAttribute("data-group") ??
          "",
        dim: element.classList.contains("map-dim"),
        faded: element.classList.contains("map-faded"),
        selected: element.hasAttribute("data-selected"),
        opacity: Number(getComputedStyle(element).opacity),
      })),
    );
}

/** データの印を流している線の ID */
function packetWires(page: Page) {
  return page
    .locator(".map-packets .map-packet")
    .evaluateAll((packets) => [
      ...new Set(packets.map((packet) => packet.getAttribute("data-wire"))),
    ]);
}

/** 要素の矩形（ページの座標） */
function rectOf(page: Page, selector: string) {
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

// 入れ子のグループと色を持つグループを面で重ね、凡例を出さず、全てのノードに高さ 24px の種類の行を置く（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openMap("default");
  // 検証
  const groups = await page
    .locator(".map-group")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-group")),
    );
  expect(groups.sort()).toEqual(["lib", "place", "read", "store"]);
  const lib = await rectOf(page, '.map-group[data-group="lib"]');
  for (const inner of ["read", "place"]) {
    const box = await rectOf(page, `.map-group[data-group="${inner}"]`);
    expect(box.left).toBeGreaterThan(lib.left);
    expect(box.top).toBeGreaterThan(lib.top);
    expect(box.right).toBeLessThan(lib.right);
    expect(box.bottom).toBeLessThan(lib.bottom);
  }
  const fills = await page
    .locator(".map-group")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => [
          element.getAttribute("data-group"),
          getComputedStyle(element).backgroundColor,
        ]),
      ),
    );
  expect(fills.read).not.toBe("rgba(0, 0, 0, 0)");
  expect(fills.read).not.toBe(fills.place);
  await expect(page.locator(".mdmark-diagram-legend li").count()).resolves.toBe(
    0,
  );
  const kindRows = await page
    .locator(".mdmark-diagram-node[data-node] .mdmark-diagram-node-kind")
    .evaluateAll((rows) =>
      rows.map((row) => Math.round(row.getBoundingClientRect().height)),
    );
  expect(kindRows).toHaveLength(10);
  expect(new Set(kindRows)).toEqual(new Set([24]));
  await expect(
    page.locator("path.mdmark-diagram-wire[stroke-dasharray]").count(),
  ).resolves.toBe(2);
  await expect(
    page
      .locator('path.mdmark-diagram-wire[data-wire="route->frame"]')
      .getAttribute("marker-start"),
  ).resolves.not.toBeNull();
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 中へ入ると外の要素を薄くし、入ったグループのタイトルをボタンでない文字にする（Entered）
test("test_entered", async () => {
  // 準備・実行
  const page = await openMap("entered");
  // 検証
  const marks = await marksOf(page);
  const faded = marks.filter((mark) => mark.faded).map((mark) => mark.id);
  expect(faded.sort()).toEqual(["store", "user"]);
  for (const mark of marks.filter((item) => item.faded)) {
    expect(mark.opacity).toBeLessThan(1);
  }
  const lib = page.locator('.map-group[data-group="lib"]');
  await expect(lib.locator("button.map-group-title").count()).resolves.toBe(0);
  await expect(lib.locator(".map-group-title").innerText()).resolves.toBe(
    "mdmark",
  );
});

// グループを閉じると、開くボタンを持つ二重の枠線のノードにし、そこへの線を 1 本にまとめて本数とラベルを出さない（Collapsed）
test("test_collapsed", async () => {
  // 準備・実行
  const page = await openMap("collapsed");
  // 検証
  const closed = page.locator('.map-closed-group[data-group="read"]');
  await expect(closed.count()).resolves.toBe(1);
  await expect(
    closed.evaluate((element) => getComputedStyle(element).borderTopStyle),
  ).resolves.toBe("double");
  const toggle = closed.locator("button.map-disclosure");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(toggle.getAttribute("aria-label")).resolves.toBe(
    "記法の読み取りを開く",
  );
  for (const id of ["marker", "mermaid", "data"]) {
    await expect(
      page.locator(`.mdmark-diagram-node[data-node="${id}"]`).count(),
    ).resolves.toBe(0);
  }
  const wires = await page
    .locator("path.mdmark-diagram-wire")
    .evaluateAll((paths) =>
      paths.map((path) => path.getAttribute("data-wire") ?? ""),
    );
  expect(wires.filter((id) => id === "mount->read")).toHaveLength(1);
  const labels = await page
    .locator(".mdmark-diagram-label")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-wire")),
    );
  expect(labels.filter((id) => (id ?? "").includes("read"))).toEqual([]);
});

// ノードを 1 つ選ぶと、そのノードとその線のほか（線の相手のノードを含む）を薄くし、その線にデータの印を流す（SelectedOne）
test("test_selected_one", async () => {
  // 準備・実行
  const page = await openMap("selected-one");
  // 検証
  const marks = await marksOf(page);
  const mount = marks.find((mark) => mark.id === "mount");
  expect(mount).toMatchObject({ selected: true, dim: false });
  for (const mark of marks.filter((item) => item.id !== "mount")) {
    if (mark.id.includes("->")) {
      const touches = mark.id.split("->").includes("mount");
      expect(mark.dim, mark.id).toBe(!touches);
    } else if (!["lib", "read", "place", "store"].includes(mark.id)) {
      expect(mark.dim, mark.id).toBe(true);
      expect(mark.opacity, mark.id).toBeCloseTo(0.25, 2);
    }
  }
  expect((await packetWires(page)).sort()).toEqual(
    ["mount->marker", "user->mount"].sort(),
  );
  await expect(
    page
      .locator('.mdmark-diagram-node[data-node="mount"]')
      .getAttribute("aria-label"),
  ).resolves.toBe("mount（選択中）");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ノードを 2 つ選ぶと、選んだノードどうしの線だけを残す（SelectedTwo）
test("test_selected_two", async () => {
  // 準備・実行
  const page = await openMap("selected-two");
  // 検証
  const marks = await marksOf(page);
  const kept = marks
    .filter((mark) => !mark.dim && mark.id.includes("->"))
    .map((mark) => mark.id);
  expect(kept).toEqual(["mount->marker"]);
  const selected = marks.filter((mark) => mark.selected).map((mark) => mark.id);
  expect(selected.sort()).toEqual(["marker", "mount"]);
  expect(await packetWires(page)).toEqual(["mount->marker"]);
});

// 案内の手順で強調したノードどうしの線のほかを薄くし、その線にデータの印を流す（Focused）
test("test_focused", async () => {
  // 準備・実行
  const page = await openMap("focused");
  // 検証
  const marks = await marksOf(page);
  const kept = marks
    .filter(
      (mark) =>
        !mark.dim && !["lib", "read", "place", "store"].includes(mark.id),
    )
    .map((mark) => mark.id);
  expect(kept.sort()).toEqual(["layout", "layout->route", "route"]);
  expect(await packetWires(page)).toEqual(["layout->route"]);
  const hidden = await page.locator(".map-packets").getAttribute("aria-hidden");
  expect(hidden).toBe("true");
});

// 線の真ん中の区間をノードの上へ動かすと、線と矢じりがノードの上の辺に付く（WireReattached）
test("test_wire_reattached", async () => {
  // 準備・実行
  const page = await openMap("wire-reattached");
  // 検証
  const end = await page
    .locator('path.mdmark-diagram-wire[data-wire="mount->marker"]')
    .evaluate((path) => {
      const svg = (path as SVGPathElement).ownerSVGElement;
      const point = (path as SVGPathElement).getPointAtLength(
        (path as SVGPathElement).getTotalLength(),
      );
      const box = svg?.getBoundingClientRect();
      const scale = box && svg ? box.width / svg.width.baseVal.value : 1;
      return {
        x: (box?.left ?? 0) + point.x * scale,
        y: (box?.top ?? 0) + point.y * scale,
      };
    });
  const marker = await rectOf(page, '.mdmark-diagram-node[data-node="marker"]');
  expect(end.x).toBeGreaterThan(marker.left);
  expect(end.x).toBeLessThan(marker.right);
  expect(end.y).toBeLessThanOrEqual(marker.top + 1);
  expect(end.y).toBeGreaterThanOrEqual(marker.top - 12);
});

// map.node_fit が width のときは、名前の長いノードを幅 360px まで広げてから折り返す（NodeFitWidth）
test("test_node_fit_width", async () => {
  // 準備・実行
  const page = await openMap("node-fit-width");
  // 検証
  const node = await rectOf(page, '.mdmark-diagram-node[data-node="layout"]');
  expect(node.right - node.left).toBeGreaterThan(220);
  expect(node.right - node.left).toBeLessThanOrEqual(360);
  const inside = await page
    .locator(
      '.mdmark-diagram-node[data-node="layout"] .mdmark-diagram-node-name',
    )
    .evaluate((name) => name.scrollWidth <= name.clientWidth);
  expect(inside).toBe(true);
});

// 幅 390px の置き場所では、倍率 1 のまま表示する枠の中で横にスクロールし、ページははみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openMap("narrow", { width: 390, height: 844 });
  // 検証
  const viewport = await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
  expect(viewport.scroll).toBeGreaterThan(viewport.client);
  const transform = await page
    .locator(".mdmark-diagram-stage")
    .evaluate((stage) => getComputedStyle(stage).transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// リンク先を持つノードは、名前を本文のリンクと同じ色と下線にし、ノードの全体をリンクにして、説明のマーカーをリンクの後ろに置く（LinkedNode）
test("test_linked_node", async () => {
  // 準備・実行
  const page = await openMap("linked-node");
  // 検証
  const node = page.locator('[data-node="mount"]');
  await expect(node.getAttribute("class")).resolves.toContain("has-link");
  await expect(node.getAttribute("tabindex")).resolves.toBeNull();
  const link = node.locator("a.mdmark-diagram-node-link");
  await expect(link.getAttribute("href")).resolves.toBe(
    "https://example.com/spec",
  );
  const decoration = await node
    .locator(".mdmark-diagram-node-name")
    .evaluate((element) => getComputedStyle(element).textDecorationLine);
  expect(decoration).toContain("underline");
  await expect(
    page.locator("a.mdmark-diagram-node-link").count(),
  ).resolves.toBe(1);
  // フォーカスはリンクに 1 回だけ止まる
  await link.focus();
  await expect(
    page.evaluate(() => document.activeElement?.className),
  ).resolves.toBe("mdmark-diagram-node-link");
});

// 説明を持つグループは、タイトルの右にノードと同じマーカーを持ち、説明を持たないグループには無い（GroupNote）
test("test_group_note", async () => {
  // 準備・実行
  const page = await openMap("group-note");
  // 検証
  const marker = page.locator(
    '.map-group[data-group="lib"] .map-group-head button.mdmark-diagram-group-info',
  );
  await expect(marker.count()).resolves.toBe(1);
  await expect(marker.getAttribute("aria-label")).resolves.toBe(
    "「mdmark」の説明",
  );
  await expect(
    page.locator("button.mdmark-diagram-group-info").count(),
  ).resolves.toBe(1);
  const title = await rectOf(
    page,
    '.map-group[data-group="lib"] .map-group-title',
  );
  const mark = await rectOf(
    page,
    '.map-group[data-group="lib"] button.mdmark-diagram-group-info',
  );
  expect(mark.left).toBeGreaterThanOrEqual(title.right - 1);
});

// 開閉・中へ入るボタン、ノード、線の押せる帯は、スクリーンリーダー向けの名前とキーを持ち、ノードの名前の文字だけを選べる（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openMap("default");
  // 検証
  const read = page.locator('.map-group[data-group="read"]');
  await expect(
    read.locator("button.map-disclosure").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  await expect(
    read.locator("button.map-disclosure").getAttribute("aria-label"),
  ).resolves.toBe("記法の読み取りを閉じる");
  await expect(
    read.locator("button.map-group-title").getAttribute("aria-label"),
  ).resolves.toBe("記法の読み取りの中へ入る");
  const node = page.locator('.mdmark-diagram-node[data-node="mount"]');
  await expect(node.getAttribute("tabindex")).resolves.toBe("0");
  await expect(node.getAttribute("aria-roledescription")).resolves.toBe(
    "ノード",
  );
  await expect(node.getAttribute("aria-keyshortcuts")).resolves.toBe(
    "Enter Space Alt+ArrowLeft Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight",
  );
  await expect(node.getAttribute("aria-pressed")).resolves.toBeNull();
  await expect(node.getAttribute("aria-label")).resolves.toBe("mount");
  const styles = await node.evaluate((element) => ({
    node: getComputedStyle(element).cursor,
    name: getComputedStyle(
      element.querySelector(".mdmark-diagram-node-name") ?? element,
    ).cursor,
    nameSelect: getComputedStyle(
      element.querySelector(".mdmark-diagram-node-name") ?? element,
    ).userSelect,
    kindSelect: getComputedStyle(
      element.querySelector(".mdmark-diagram-node-kind") ?? element,
    ).userSelect,
  }));
  expect(styles).toEqual({
    node: "grab",
    name: "text",
    nameSelect: "text",
    kindSelect: "none",
  });
  const hit = page.locator('.map-wire-hit[data-wire="user->mount"]');
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(hit.getAttribute("aria-label")).resolves.toBe(
    "利用側のページからmountへの線「設定と Markdown」",
  );
  await expect(
    page
      .locator('.map-wire-hit[data-wire="mount->marker"]')
      .getAttribute("aria-label"),
  ).resolves.toBe("mountからmap のマーカーの読み取りへの線");
  const border = await page
    .locator('.map-group[data-group="lib"]')
    .evaluate((element) => getComputedStyle(element).borderTopColor);
  const background = await resolveColorIn(
    page,
    "#storybook-root .mdmark",
    "var(--mdmark-color-bg)",
  );
  expect(contrastRatio(border, background)).toBeGreaterThanOrEqual(3);
});
