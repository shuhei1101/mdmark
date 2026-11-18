import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import {
  C4,
  C4_COMPONENT,
  C4_CONTAINER,
  C4_CONTAINER_DATA,
  C4_DATA,
  C4_DEPLOYMENT,
  C4_DEPLOYMENT_DATA,
  C4_DYNAMIC,
  C4_DYNAMIC_PLAY,
  C4_DYNAMIC_PLAY_DATA,
  C4_DYNAMIC_WALK_DATA,
  mapRange,
} from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** C4 図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadC4View = () => import("../../../../src/map/c4-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** C4 図を描いて付ける */
async function setUp(args?: string, mermaid = C4, data = C4_DATA) {
  const { attachMapC4 } = await loadC4View();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ args, mermaid, data })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapC4(range, resolveConfig({}), parseMapArgs(args ?? "").args),
  );
  return root;
}

/** 図の枠のタイトル */
const titleOf = (root: HTMLElement) =>
  root.querySelector(".mdmark-diagram-title")?.textContent ?? "";

// 要素と境界（正常系）
test("test_attach_map_c4", async () => {
  // 準備・実行
  const root = await setUp();
  // 検証
  expect(titleOf(root)).toContain("注文のシステムの全体");
  const node = (id: string) =>
    root.querySelector<HTMLElement>(`[data-node="${id}"]`);
  expect(
    node("support")?.querySelector(".mdmark-diagram-node-kind")?.textContent,
  ).toContain("[External Person]");
  const groupTitle = (id: string) =>
    root.querySelector(`.map-group[data-group="${id}"] .map-group-title`)
      ?.textContent ?? "";
  expect(groupTitle("shop")).toContain("通販［Software System］");
  expect(groupTitle("company")).toContain("自社［Enterprise］");
  const top = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("top") ?? "");
  const left = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("left") ?? "");
  expect(top("stock")).toBeCloseTo(top("store"), 0);
  expect(left("stock")).toBeGreaterThan(left("store"));
  expect(
    root.querySelector('.mdmark-diagram-label[data-wire="r1"]')?.textContent,
  ).toBe("注文する [HTTPS]");
});

// マーカーのタイトルを優先する（正常系）
test("test_attach_map_c4_when_title", async () => {
  // 準備・実行
  const root = await setUp('{"title": "全体"}');
  // 検証
  expect(titleOf(root)).toContain("全体");
  expect(titleOf(root)).not.toContain("注文のシステムの全体");
});

// 上向きの関係（正常系）
test("test_attach_map_c4_when_up", async () => {
  // 準備・実行
  const root = await setUp(
    undefined,
    'C4Context\n  System(a, "A")\n  System(b, "B")\n  Rel_U(a, b, "上へ")\n',
  );
  // 検証: b が a より上にあり、線の終点（矢じり）が b の側にある
  const node = (id: string) =>
    root.querySelector<HTMLElement>(`[data-node="${id}"]`);
  const top = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("top") ?? "");
  const height = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("height") ?? "");
  expect(top("b")).toBeLessThan(top("a"));
  const numbers =
    root
      .querySelector('path.mdmark-diagram-wire[data-wire="r1"]')
      ?.getAttribute("d")
      ?.match(/-?\d+(\.\d+)?/g)
      ?.map(Number) ?? [];
  const endY = numbers.at(-1) ?? Number.NaN;
  expect(Math.abs(endY - (top("b") + height("b")))).toBeLessThan(3);
});

// 4 種類（正常系）
test("test_attach_map_c4_when_kinds", async () => {
  // 準備・実行
  const container = await setUp(undefined, C4_CONTAINER, C4_CONTAINER_DATA);
  const component = await setUp(undefined, C4_COMPONENT, '{"version": 1}');
  const dynamic = await setUp(undefined, C4_DYNAMIC, '{"version": 1}');
  const deployment = await setUp(undefined, C4_DEPLOYMENT, C4_DEPLOYMENT_DATA);
  // 検証
  const kindRow = (root: HTMLElement, id: string) =>
    root
      .querySelector(`[data-node="${id}"] .mdmark-diagram-node-kind`)
      ?.textContent?.trim();
  const groupTitle = (root: HTMLElement, id: string) =>
    root.querySelector(`.map-group[data-group="${id}"] .map-group-title`)
      ?.textContent ?? "";
  expect(kindRow(container, "api")).toBe("[Container: Node.js]");
  expect(groupTitle(container, "shop")).toContain(
    "注文のシステム［Container］",
  );
  expect(kindRow(component, "router")).toBe("[Component: Express]");
  expect(
    dynamic.querySelector('.mdmark-diagram-label[data-wire="r3"]')?.textContent,
  ).toBe("3: 注文を保存する [SQL]");
  expect(
    deployment
      .querySelector('.map-group[data-group="cloud"]')
      ?.classList.contains("map-c4-deployment"),
  ).toBe(true);
  const left = (id: string) =>
    Number.parseFloat(
      deployment
        .querySelector<HTMLElement>(`.map-group[data-group="${id}"]`)
        ?.style.getPropertyValue("left") ?? "",
    );
  expect(left("app")).toBeLessThan(left("dbnode"));
});

// 配置先のノードを閉じる（正常系）
test("test_attach_map_c4_when_deployment_collapsed", async () => {
  // 準備
  const root = await setUp(undefined, C4_DEPLOYMENT, C4_DEPLOYMENT_DATA);
  // 実行
  root
    .querySelector<HTMLButtonElement>('button[data-group-toggle="region"]')
    ?.click();
  // 検証
  const closed = root.querySelector('.map-closed-group[data-group="region"]');
  expect(closed?.textContent).toContain("要素 2 件");
  expect(root.querySelector('.map-group[data-group="cloud"]')).not.toBeNull();
});

/** 帯の手順のバーの区切りを押す（0 始まり） */
const pressSegment = (root: HTMLElement, index: number) =>
  root.querySelectorAll<HTMLElement>(".map-band-seg")[index]?.click();

/** 要素が薄くなっているか */
const dimmed = (root: HTMLElement, selector: string) =>
  root.querySelector(selector)?.classList.contains("map-dim");

// C4Dynamic の関係の再生（正常系）
test("test_attach_map_c4_when_dynamic_played", async () => {
  // 準備
  const root = await setUp(undefined, C4_DYNAMIC_PLAY, C4_DYNAMIC_PLAY_DATA);
  // 実行
  pressSegment(root, 1);
  // 検証
  const band = root.querySelector<HTMLElement>(".map-band") as HTMLElement;
  expect(band.getAttribute("data-mode")).toBe("playback");
  expect(band.querySelectorAll(".map-band-seg")).toHaveLength(5);
  const labels = [...band.querySelectorAll("button")].map((button) =>
    button.getAttribute("aria-label"),
  );
  expect(labels).toEqual(expect.arrayContaining(["前の関係", "次の関係"]));
  expect(band.querySelector(".map-band-title")?.textContent).toBe(
    "2: 注文の画面 → 注文の API：注文を送る",
  );
  expect(band.querySelector(".map-band-text")?.textContent).toBe(
    "画面の入力を JSON にして API へ送る",
  );
  expect(dimmed(root, '.mdmark-diagram-node[data-node="web"]')).toBe(false);
  expect(dimmed(root, '.mdmark-diagram-node[data-node="api"]')).toBe(false);
  expect(dimmed(root, '.mdmark-diagram-node[data-node="customer"]')).toBe(true);
  expect(dimmed(root, '.mdmark-diagram-wire[data-wire="r2"]')).toBe(false);
  expect(dimmed(root, '.mdmark-diagram-wire[data-wire="r3"]')).toBe(true);
  const packets = [...root.querySelectorAll(".map-packet")];
  expect(packets.length).toBeGreaterThan(0);
  expect(
    packets.every((packet) => packet.getAttribute("data-wire") === "r2"),
  ).toBe(true);
});

// 閉じた境界の中の要素への関係（正常系）
test("test_attach_map_c4_when_dynamic_boundary", async () => {
  // 準備
  const root = await setUp(undefined, C4_DYNAMIC_PLAY, C4_DYNAMIC_PLAY_DATA);
  // 実行
  pressSegment(root, 3);
  // 検証
  expect(
    root
      .querySelector('[data-group="store"]')
      ?.classList.contains("map-closed-group"),
  ).toBe(true);
  expect(dimmed(root, '.map-closed-group[data-group="store"]')).toBe(false);
  expect(dimmed(root, '.mdmark-diagram-node[data-node="api"]')).toBe(false);
  const label = () =>
    root.querySelector('.mdmark-diagram-label[data-wire="api->store"]');
  expect(label()?.textContent?.startsWith("4: ")).toBe(true);
  // 実行・検証: 手順を止めると、出したラベルが無くなる
  root
    .querySelector<HTMLElement>('.map-band [role="slider"]')
    ?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  expect(label()).toBeNull();
});

// 両向きの関係（正常系）
test("test_attach_map_c4_when_dynamic_both", async () => {
  // 準備
  const root = await setUp(undefined, C4_DYNAMIC_PLAY, C4_DYNAMIC_PLAY_DATA);
  // 実行
  pressSegment(root, 4);
  // 検証
  expect(root.querySelector(".map-band .map-band-title")?.textContent).toBe(
    "5: 注文の画面 ↔ 顧客：結果を確かめる",
  );
  const packets = [...root.querySelectorAll('.map-packet[data-wire="r5"]')];
  const backward = (packet: Element) =>
    packet.querySelector("animateMotion")?.getAttribute("keyPoints") === "1;0";
  expect(packets.some(backward)).toBe(true);
  expect(packets.some((packet) => !backward(packet))).toBe(true);
});

// 案内の手順を持つ C4Dynamic（正常系）
test("test_attach_map_c4_when_dynamic_walkthroughs", async () => {
  // 準備・実行
  const root = await setUp(undefined, C4_DYNAMIC_PLAY, C4_DYNAMIC_WALK_DATA);
  // 検証
  const band = root.querySelector<HTMLElement>(".map-band") as HTMLElement;
  expect(band.getAttribute("data-mode")).toBe("walkthrough");
  expect(band.querySelectorAll(".map-band-seg")).toHaveLength(2);
});

// ほかの種類の図は再生しない（正常系）
test("test_attach_map_c4_when_container_no_playback", async () => {
  // 準備・実行
  const root = await setUp(undefined, C4_CONTAINER, C4_CONTAINER_DATA);
  // 検証
  expect(root.querySelector(".map-band")?.getAttribute("data-mode")).not.toBe(
    "playback",
  );
});

// 再生中に別の線を指したときは、再生中の関係のラベルを出さない（正常系）
test("test_attach_map_c4_when_dynamic_other_wire_pointed", async () => {
  // 準備（2 本目の関係を再生する）
  const root = await setUp(undefined, C4_DYNAMIC_PLAY, C4_DYNAMIC_PLAY_DATA);
  pressSegment(root, 1);
  // 実行（ラベルを持たない、閉じた境界への線を指す）
  root
    .querySelector('.map-wire-hit[data-wire="api->store"]')
    ?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  // 検証
  expect(root.querySelectorAll(".map-c4-playing-label")).toHaveLength(0);
});
