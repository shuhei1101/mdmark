import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  contrastRatio,
  createBrowserHolder,
  expectCountBelowTitle,
  expectTargetSize,
  mapWireOverlaps,
  overlaps,
  pageOverflows,
  resolveColorIn,
  targetSizeViolations,
  textContrastsOf,
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
    expect(mark.opacity, mark.id).toBe(1);
  }
  for (const { id, ratio } of await textContrastsOf(
    page,
    ".mdmark-diagram-stage :is(.map-faded, .mdmark-diagram-label.map-dim)",
  )) {
    expect(ratio, id).toBeGreaterThanOrEqual(4.5);
  }
  const lib = page.locator('.map-group[data-group="lib"]');
  await expect(lib.locator("button.map-group-title").count()).resolves.toBe(0);
  await expect(lib.locator(".map-group-title").innerText()).resolves.toBe(
    "mdmark",
  );
});

// グループを閉じると、開くボタンを持つ二重の枠線のノードにし、タイトルの行の下に数の行を重ねずに置き、そこへの線を 1 本にまとめて本数とラベルを出さない（Collapsed）
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
  await expectCountBelowTitle(
    page,
    '.map-closed-group[data-group="read"]',
    "ノード 3 件",
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
      if (mark.dim) expect(mark.opacity, mark.id).toBeCloseTo(0.25, 2);
    } else if (!["lib", "read", "place", "store"].includes(mark.id)) {
      expect(mark.dim, mark.id).toBe(true);
      expect(mark.opacity, mark.id).toBe(1);
    }
  }
  for (const { id, ratio } of await textContrastsOf(
    page,
    ".mdmark-diagram-stage :is(.mdmark-diagram-node[data-node], .mdmark-diagram-label).map-dim",
  )) {
    expect(ratio, id).toBeGreaterThanOrEqual(4.5);
  }
  expect((await packetWires(page)).sort()).toEqual(
    ["mount->marker", "user->mount"].sort(),
  );
  await expect(
    page
      .locator(
        '.mdmark-diagram-node[data-node="mount"] > .mdmark-diagram-node-hit',
      )
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

// ノードの右上とグループのタイトルの右の説明のマーカーは、押せる大きさ 24px 四方以上で描く（GroupNote）
test("test_group_note_info_marker_size", async () => {
  // 準備・実行
  const page = await openMap("group-note");
  // 検証
  await expectTargetSize(page, "button.mdmark-diagram-group-info");
  await expectTargetSize(
    page,
    ".mdmark-diagram-stage button.mdmark-diagram-info:not(.mdmark-diagram-group-info)",
  );
});

// 説明を持つノードの右上のマーカーは、ノードの種類の行の文字（アイコンと種類の名前）と名前の文字に重ならない（GroupNote）
test("test_group_note_info_marker_not_overlapping", async () => {
  // 準備・実行
  const page = await openMap("group-note");
  // 検証
  const nodes = await page
    .locator(".mdmark-diagram-stage .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) => {
      const toBox = (rect: DOMRect) => ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      });
      // 要素の中身（文字とアイコン）の範囲。描かれない要素は null
      const contentOf = (element: Element | null) => {
        if (!element || getComputedStyle(element).display === "none") {
          return null;
        }
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return rect.width > 0 ? toBox(rect) : null;
      };
      return elements.flatMap((node) => {
        const marker = node.querySelector("button.mdmark-diagram-info");
        if (!marker) {
          return [];
        }
        return [
          {
            id: node.getAttribute("data-node") ?? "",
            marker: toBox(marker.getBoundingClientRect()),
            kind: contentOf(node.querySelector(".mdmark-diagram-node-kind")),
            name: contentOf(node.querySelector(".mdmark-diagram-node-name")),
          },
        ];
      });
    });
  expect(nodes.length).toBeGreaterThan(0);
  for (const node of nodes) {
    expect(node.name, node.id).not.toBeNull();
    if (node.kind) {
      expect(overlaps(node.marker, node.kind), `${node.id} の種類の行`).toBe(
        false,
      );
    }
    if (node.name) {
      expect(overlaps(node.marker, node.name), `${node.id} の名前`).toBe(false);
    }
  }
});

// hints が false なら、説明を持つノード・グループ・線にマーカーとツールチップが無く、線のラベル・ノードの名前・グループのタイトルは描く（HintsOff）
test("test_hints_off", async () => {
  // 準備・実行
  const page = await openMap("hints-off");
  // 検証
  await expect(page.locator(".mdmark-diagram-info").count()).resolves.toBe(0);
  await expect(page.locator("[data-tip-owner]").count()).resolves.toBe(0);
  await expect(page.locator('[role="tooltip"]').count()).resolves.toBe(0);
  await expect(
    page.locator('.map-group[data-group="lib"] .map-group-title').textContent(),
  ).resolves.toBe("mdmark");
  await expect(
    page.locator('[data-node="mount"] .mdmark-diagram-node-name').textContent(),
  ).resolves.toBe("mount");
  await expect(
    page.locator('.mdmark-diagram-label[data-wire="user->mount"]').count(),
  ).resolves.toBe(1);
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
  await expect(node.getAttribute("tabindex")).resolves.toBeNull();
  await expect(node.getAttribute("role")).resolves.toBeNull();
  const nodeHit = node.locator(":scope > .mdmark-diagram-node-hit");
  await expect(nodeHit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(nodeHit.getAttribute("role")).resolves.toBe("button");
  await expect(nodeHit.getAttribute("aria-roledescription")).resolves.toBe(
    "ノード",
  );
  await expect(nodeHit.getAttribute("aria-keyshortcuts")).resolves.toBe(
    "Enter Space Alt+ArrowLeft Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight",
  );
  await expect(nodeHit.getAttribute("aria-pressed")).resolves.toBeNull();
  await expect(nodeHit.getAttribute("aria-label")).resolves.toBe("mount");
  // 押せる要素（role="button"）の中にフォーカスできる要素を入れ子にしない（説明を持つ data・layout のノードを含む）
  const nested = await page.evaluate(
    () =>
      [...document.querySelectorAll('[role="button"], button, a[href]')].filter(
        (element) =>
          element.querySelector(
            'button, a[href], [tabindex]:not([tabindex="-1"]), [role="button"]',
          ) !== null,
      ).length,
  );
  expect(nested).toBe(0);
  for (const id of ["data", "layout"]) {
    const described = page.locator(`.mdmark-diagram-node[data-node="${id}"]`);
    await expect(
      described.locator("button.mdmark-diagram-info").count(),
    ).resolves.toBe(1);
    await expect(
      described
        .locator(".mdmark-diagram-node-hit button.mdmark-diagram-info")
        .count(),
    ).resolves.toBe(0);
  }
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
  // 線の押せる範囲は区間ごとの帯で、最も長い区間の帯だけがフォーカスと名前を持つ
  const hit = page.locator('.map-wire-hit[data-wire="user->mount"] [tabindex]');
  await expect(hit.count()).resolves.toBe(1);
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(hit.getAttribute("aria-label")).resolves.toBe(
    "利用側のページからmountへの線「設定と Markdown」",
  );
  await expect(
    page
      .locator('.map-wire-hit[data-wire="mount->marker"] [aria-label]')
      .getAttribute("aria-label"),
  ).resolves.toBe("mountからmap のマーカーの読み取りへの線");
  // 最も長い区間の帯のほかは読み上げから除外し、ポインターの形状は区間の向きで決まる
  const bandStates = await page
    .locator('.map-wire-hit[data-wire="user->mount"] .map-wire-hit-segment')
    .evaluateAll((bands) =>
      bands.map((band) => ({
        focusable: band.getAttribute("tabindex") === "0",
        hidden: band.getAttribute("aria-hidden") === "true",
        axis: band.getAttribute("data-axis"),
        cursor: getComputedStyle(band).cursor,
      })),
    );
  for (const band of bandStates) {
    expect(band.focusable).toBe(!band.hidden);
    expect(band.cursor).toBe(band.axis === "y" ? "ew-resize" : "ns-resize");
  }
  // フォーカスした線は、全ての区間の帯に色が付く
  await hit.focus();
  const fills = await page
    .locator('.map-wire-hit[data-wire="user->mount"] .map-wire-hit-segment')
    .evaluateAll((bands) => bands.map((band) => getComputedStyle(band).fill));
  for (const fill of fills) expect(fill).not.toBe("rgba(0, 0, 0, 0)");
  // ノードの名前は 13px、種類の行と線のラベルは 11px で、どれも太さ 400
  const fontOf = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.fontSize} ${style.fontWeight}`;
      });
  await expect(fontOf(".mdmark-diagram-node-name")).resolves.toBe("13px 400");
  await expect(fontOf(".mdmark-diagram-node-kind")).resolves.toBe("11px 400");
  await expect(fontOf(".mdmark-diagram-label")).resolves.toBe("11px 400");
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

// 同じ列の 3 つのノードから別のグループへ出る 3 本の線は、同じ向きの区間が同じ直線の上で重ならない（ParallelWires）
test("test_parallel_wires", async () => {
  // 準備・実行
  const page = await openMap("parallel-wires");
  // 検証
  const wires = await page
    .locator(".map-wire-hits > .map-wire-hit[data-wire]")
    .evaluateAll((paths) =>
      paths.map((path) => path.getAttribute("data-wire") ?? ""),
    );
  expect(wires.sort()).toEqual(["a1->b3", "a2->b1", "a3->b2"]);
  await expect(mapWireOverlaps(page)).resolves.toEqual([]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 範囲の外の純粋な Mermaid の構成図は、種類を持たないノードの名前を上下の中央に描く（Plain）
test("test_plain", async () => {
  // 準備・実行
  const page = await openMap("plain");
  // 検証
  const offsets = await page
    .locator(".mdmark-diagram-node[data-node]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        const name = node
          .querySelector(".mdmark-diagram-node-name")
          ?.getBoundingClientRect();
        return name === undefined
          ? Number.POSITIVE_INFINITY
          : Math.abs(name.top + name.height / 2 - (box.top + box.height / 2));
      }),
    );
  expect(offsets.length).toBeGreaterThan(0);
  for (const offset of offsets) expect(offset).toBeLessThanOrEqual(2);
  await expect(page.locator(".mdmark-diagram-info").count()).resolves.toBe(0);
});

/** ノードの名前の行の数と、名前の最後の行の下端がノードの下の余白より上にあるか */
function nameFitOf(page: Page, node: string) {
  return page
    .locator(`.mdmark-diagram-node[data-node="${node}"]`)
    .evaluate((element) => {
      const name = element.querySelector(".mdmark-diagram-node-name");
      const range = document.createRange();
      if (name) range.selectNodeContents(name);
      const rects = [...range.getClientRects()];
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const limit =
        box.bottom -
        Number.parseFloat(style.borderBottomWidth) -
        Number.parseFloat(style.paddingBottom);
      return {
        width: box.width,
        lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
        fits: Math.max(...rects.map((rect) => rect.bottom)) <= limit + 0.5,
        kind:
          element.querySelector(".mdmark-diagram-node-kind")?.textContent ?? "",
      };
    });
}

// 種類の行を持ち名前が折り返すノードは、名前の行が全て入り、最後の行が下の余白より上にある（WrappedName）
test("test_wrapped_name", async () => {
  // 準備・実行
  const page = await openMap("wrapped-name");
  // 検証
  const first = await nameFitOf(page, "total");
  expect(first.kind).toContain("処理");
  expect(first.width).toBeLessThanOrEqual(220.5);
  expect(first.lines).toBeGreaterThanOrEqual(2);
  expect(first.fits).toBe(true);
  const second = await nameFitOf(page, "save");
  expect(second.kind).toContain("処理");
  expect(second.width).toBeLessThanOrEqual(220.5);
  expect(second.lines).toBe(1);
  expect(second.fits).toBe(true);
});

// 補足の changes を持つ構成図は、追加・変更・削除を色・破線・取り消し線・バッジで示す（PlannedChanges）
test("test_planned_changes", async () => {
  // 準備・実行
  const page = await openMap("planned-changes");
  // 検証
  const added = await resolveColorIn(
    page,
    ".mdmark-diagram",
    "var(--mdmark-color-diff-add-sign)",
  );
  const removed = await resolveColorIn(
    page,
    ".mdmark-diagram",
    "var(--mdmark-color-diff-del-sign)",
  );
  const orange = await resolveColorIn(
    page,
    ".mdmark-diagram",
    "var(--mdmark-color-accent-orange-text)",
  );
  const green = await resolveColorIn(
    page,
    ".mdmark-diagram",
    "var(--mdmark-color-accent-green-text)",
  );
  const node = (id: string) =>
    page.locator(`.mdmark-diagram-node[data-node="${id}"]`);
  const style = (id: string) =>
    node(id).evaluate((element) => {
      const name = element.querySelector(".mdmark-diagram-node-name");
      const kind = element.querySelector(".mdmark-diagram-node-kind svg");
      return {
        border: getComputedStyle(element).borderTopColor,
        borderStyle: getComputedStyle(element).borderTopStyle,
        decoration: name ? getComputedStyle(name).textDecorationLine : "",
        kindColor: kind ? getComputedStyle(kind).color : "",
        badge:
          element.querySelector(":scope > .mdmark-map-change")?.textContent ??
          "",
      };
    });
  const user = await style("user");
  expect(user.border).toBe(added);
  expect(user.kindColor).toBe(green);
  expect(user.badge).toBe("追加");
  const mount = await style("mount");
  expect(mount.border).toBe(orange);
  expect(mount.badge).toBe("変更");
  const legacy = await style("legacy");
  expect(legacy.border).toBe(removed);
  expect(legacy.borderStyle).toBe("dashed");
  expect(legacy.decoration).toContain("line-through");
  expect(legacy.badge).toBe("削除");
  const wires = await page
    .locator(
      '.mdmark-diagram-wires path:is([data-wire="user->mount"], [data-wire="mount->legacy"])',
    )
    .evaluateAll((paths) =>
      paths.map((path) => ({
        id: path.getAttribute("data-wire"),
        stroke: getComputedStyle(path).stroke,
        dash: getComputedStyle(path).strokeDasharray,
      })),
    );
  expect(wires.length).toBeGreaterThan(1);
  for (const wire of wires) {
    expect(wire.stroke).toBe(wire.id === "user->mount" ? added : removed);
    if (wire.id === "mount->legacy") expect(wire.dash).not.toBe("none");
  }
});

// style・classDef・linkStyle の色を適用した。ノード A の面と枠線が指定の色、D・E の面が classDef の色で文字が黒、2 本目の線が赤。ほかは map の配色（Styled）
test("test_styled", async () => {
  // 準備・実行
  const page = await openMap("styled");
  // 検証
  const nodes = await page
    .locator(".mdmark-diagram-stage .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => {
          const style = getComputedStyle(element);
          const name = element.querySelector(".mdmark-diagram-node-name");
          return [
            element.getAttribute("data-node") ?? "",
            {
              fill: style.backgroundColor,
              stroke: style.borderTopColor,
              text: name ? getComputedStyle(name).color : "",
            },
          ];
        }),
      ),
    );
  expect(nodes.A).toEqual({
    fill: "rgb(255, 153, 255)",
    stroke: "rgb(204, 51, 204)",
    text: "rgb(0, 0, 0)",
  });
  for (const id of ["D", "E"]) {
    expect(nodes[id]?.fill).toBe("rgb(255, 224, 138)");
    expect(nodes[id]?.stroke).toBe("rgb(184, 134, 11)");
    expect(nodes[id]?.text).toBe("rgb(0, 0, 0)");
  }
  for (const id of ["B", "C"]) {
    expect(nodes[id]?.fill).not.toBe("rgb(255, 153, 255)");
    expect(nodes[id]?.fill).not.toBe("rgb(255, 224, 138)");
  }
  const strokes = await page
    .locator(".mdmark-diagram-wires path.mdmark-diagram-wire[data-wire]")
    .evaluateAll((paths) =>
      Object.fromEntries(
        paths.map((path) => [
          path.getAttribute("data-wire") ?? "",
          getComputedStyle(path).stroke,
        ]),
      ),
    );
  expect(strokes["B->C"]).toBe("rgb(221, 51, 51)");
  expect(
    Object.entries(strokes).filter(
      ([, stroke]) => stroke === "rgb(221, 51, 51)",
    ),
  ).toHaveLength(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 端に丸・×を付けた線・見えない線でつないだノード・長さを指定した線と、平行四辺形・台形・二重の円・文書の形状のノード（WireEndsAndShapes）
test("test_wire_ends_and_shapes", async () => {
  // 準備・実行
  const page = await openMap("wire-ends-and-shapes");
  // 検証
  const ends = await page
    .locator(".mdmark-diagram-wires path.mdmark-diagram-wire[data-wire]")
    .evaluateAll((paths) =>
      Object.fromEntries(
        paths.map((path) => {
          const endOf = (name: string) => {
            const id = /url\(#([^)]+)\)/.exec(
              path.getAttribute(name) ?? "",
            )?.[1];
            return id === undefined
              ? undefined
              : (document.getElementById(id)?.getAttribute("data-end") ??
                  "head");
          };
          return [
            path.getAttribute("data-wire") ?? "",
            { start: endOf("marker-start"), end: endOf("marker-end") },
          ];
        }),
      ),
    );
  expect(ends["A->B"]?.end).toBe("circle");
  expect(ends["A->C"]?.end).toBe("cross");
  expect(ends["B->C"]).toBeUndefined();
  await expect(
    page.locator('.mdmark-diagram-stage [data-wire="B->C"]').count(),
  ).resolves.toBe(0);
  const shapes = await page
    .locator(".mdmark-diagram-stage .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          const name = element
            .querySelector(".mdmark-diagram-node-name")
            ?.getBoundingClientRect();
          return [
            element.getAttribute("data-node") ?? "",
            {
              shape: element.getAttribute("data-shape"),
              inside: name
                ? name.left >= rect.left &&
                  name.right <= rect.right &&
                  name.top >= rect.top &&
                  name.bottom <= rect.bottom
                : false,
            },
          ];
        }),
      ),
    );
  expect(["L", "M", "N", "O", "P"].map((id) => shapes[id]?.shape)).toEqual([
    "lean-right",
    "lean-left",
    "trapezoid",
    "double-circle",
    "doc",
  ]);
  for (const id of ["L", "M", "N", "O", "P"])
    expect(shapes[id]?.inside).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 1 つのノードの下の辺から 4 本、上の辺に 2 本の線が出入りし、端は辺の中点に集まらず相手の並びの順に 16px 間隔で並ぶ（SharedSide）
test("test_shared_side", async () => {
  // 準備・実行
  const page = await openMap("shared-side");
  // 検証
  const ends = await page
    .locator("path.mdmark-diagram-wire[data-wire]")
    .evaluateAll((paths) =>
      paths.map((path) => {
        const points = [
          ...(path.getAttribute("d") ?? "").matchAll(
            /[ML](-?[\d.]+)[ ,](-?[\d.]+)/g,
          ),
        ].map((match) => [Number(match[1]), Number(match[2])]);
        return {
          id: path.getAttribute("data-wire") ?? "",
          start: points[0] as number[],
          end: points.at(-1) as number[],
        };
      }),
    );
  // 同じノードの同じ辺の端（hub の同じ x か同じ y に並ぶ端）をまとめ、2 本以上の辺ごとに確かめる
  const hubEnds = ends.flatMap((wire) => [
    ...(wire.id.startsWith("hub->") ? [wire.start] : []),
    ...(wire.id.endsWith("->hub") ? [wire.end] : []),
  ]) as Array<[number, number]>;
  expect(hubEnds).toHaveLength(6);
  const sides = new Map<string, number[]>();
  for (const [x, y] of hubEnds) {
    sides.set(`y${y}`, [...(sides.get(`y${y}`) ?? []), x]);
    sides.set(`x${x}`, [...(sides.get(`x${x}`) ?? []), y]);
  }
  const shared = [...sides.values()].filter((along) => along.length >= 2);
  // 相手に向いた辺が同じ線（遠い相手は左右の辺へ出る）は、端が辺の中点 1 か所に集まらない
  expect(shared.length).toBeGreaterThan(0);
  for (const along of shared) {
    const sorted = [...along].sort((a, b) => a - b);
    expect(new Set(sorted).size).toBe(sorted.length);
    for (const [index, value] of sorted.slice(1).entries())
      expect(value - (sorted[index] as number)).toBeGreaterThanOrEqual(15.5);
  }
  await expect(mapWireOverlaps(page)).resolves.toEqual([]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 同じ辺から出る線の押せる範囲は区間ごとの帯で、線から離れたノードを含まず、axe の target-size の違反が無い（SharedSide）
test("test_wire_hit_target_size", async () => {
  // 準備・実行
  const page = await openMap("shared-side");
  // 検証
  await expect(targetSizeViolations(page)).resolves.toEqual([]);
});
