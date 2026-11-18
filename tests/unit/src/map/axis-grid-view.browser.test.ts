import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import {
  BLOCK,
  BLOCK_DATA,
  BLOCK_LAYOUT_DATA,
  GANTT,
  GANTT_DATA,
  GANTT_LAYOUT_DATA,
  GIT_GRAPH,
  GIT_GRAPH_DATA,
  JOURNEY,
  JOURNEY_DATA,
  mapRange,
  TIMELINE,
  TIMELINE_DATA,
} from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** 軸と格子の配置の図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const AXIS_GRID_VIEW = "../../../../src/map/axis-grid-view.ts";
const loadAxisGridView = (): Promise<
  typeof import("../../../../src/map/axis-grid-view.ts")
> => import(/* @vite-ignore */ AXIS_GRID_VIEW);
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** sessionStorage に保った図の状態（`order` は 1 から数えた図の番号） */
const saved = (order = 1) =>
  JSON.parse(
    sessionStorage.getItem(`mdmark-map:${location.pathname}#${order}`) ?? "{}",
  );

/** 範囲を並べて描き、全ての図を付ける */
async function setUp(ranges: Array<{ mermaid: string; data?: string }>) {
  const { attachMapAxisGrid } = await loadAxisGridView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(ranges.map((range) => mapRange(range)).join("\n")).html,
  );
  for (const range of root.querySelectorAll<HTMLElement>(".mdmark-map")) {
    handles.push(
      attachMapAxisGrid(range, resolveConfig({}), {
        args: parseMapArgs("").args,
        today: () => "2026-11-12",
      }),
    );
  }
  return root;
}

/** 範囲の中の図の枠（`order` は 1 から数えた図の番号） */
const figureOf = (root: HTMLElement, order = 1) =>
  root.querySelectorAll<HTMLElement>(
    'figure.mdmark-diagram[data-diagram="map"]',
  )[order - 1] as HTMLElement;

/** 項目の要素 */
const itemOf = (scope: HTMLElement, key: string) =>
  scope.querySelector<HTMLElement>(
    `.map-axis-item[data-node="${CSS.escape(key)}"]`,
  );

/** 項目の押せる要素 */
const hitOf = (scope: HTMLElement, key: string) =>
  itemOf(scope, key)?.querySelector<HTMLElement>(".mdmark-diagram-node-hit") ??
  null;

/** 図の枠の中のキー操作 */
const pressKey = (target: Element | null, key: string) =>
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

/** 帯の手順のバーの `ordinal` つ目（1 から）の区切りを押す */
const pressSegment = (figure: HTMLElement, ordinal: number) => {
  figure
    .closest(".mdmark-map")
    ?.querySelectorAll<HTMLElement>(".map-band .map-band-seg")
    [ordinal - 1]?.click();
};

// 5 種類を描く（正常系）
test("test_attach_map_axis_grid", async () => {
  // 準備・実行
  const root = await setUp([
    { mermaid: GANTT, data: GANTT_DATA },
    { mermaid: TIMELINE, data: TIMELINE_DATA },
    { mermaid: GIT_GRAPH, data: GIT_GRAPH_DATA },
    { mermaid: JOURNEY, data: JOURNEY_DATA },
    { mermaid: BLOCK, data: BLOCK_DATA },
  ]);
  // 検証
  const figures = root.querySelectorAll<HTMLElement>(
    'figure.mdmark-diagram[data-diagram="map"]',
  );
  expect(figures).toHaveLength(5);
  const kinds = [...root.querySelectorAll<HTMLElement>(".mdmark-map")].map(
    (range) => range.dataset.mapKind,
  );
  expect(kinds).toEqual(["gantt", "timeline", "gitGraph", "journey", "block"]);
  expect(
    itemOf(figureOf(root, 1), "imp")?.querySelector(".mdmark-diagram-info"),
  ).not.toBeNull();
  expect(
    itemOf(figureOf(root, 3), "axis")?.querySelector(".mdmark-diagram-info"),
  ).not.toBeNull();
  const bands = [...root.querySelectorAll<HTMLElement>(".mdmark-map")].map(
    (range) => range.querySelector(".map-band") !== null,
  );
  expect(bands).toEqual([true, true, true, true, false]);
  expect(
    figureOf(root, 3).querySelector(".mdmark-diagram-title")?.textContent,
  ).toBe("Git グラフ");
  expect(
    figureOf(root, 5).querySelector(".mdmark-diagram-title")?.textContent,
  ).toBe("ブロック図");
});

// section を閉じて中へ入る（正常系）
test("test_attach_map_axis_grid_when_section_toggled", async () => {
  // 準備
  const root = await setUp([{ mermaid: GANTT, data: GANTT_DATA }]);
  const toggle = () =>
    root.querySelector<HTMLButtonElement>('[data-map-section-toggle="開発"]');
  // 実行
  toggle()?.click();
  // 検証
  expect(saved().collapsed).toEqual(["開発"]);
  expect(itemOf(root, "開発")?.textContent).toContain("開発");
  expect(itemOf(root, "開発")?.textContent).toContain("（タスク 2 件）");
  expect(document.activeElement).toBe(toggle());
  // 実行・検証: 2 つ目の「準備」の中へ入る
  root
    .querySelector<HTMLButtonElement>('[data-map-section-enter="s3"]')
    ?.click();
  expect(saved().entered).toBe("s3");
  expect(
    root.querySelector(".map-axis-trail")?.textContent?.replace(/\s+/g, " "),
  ).toContain("全体 › 準備");
  // 実行・検証: Esc で外へ戻る
  pressKey(root.querySelector("figure"), "Escape");
  expect(saved().entered).toBeUndefined();
});

// 項目・ブランチ・人を選ぶ（正常系）
test("test_attach_map_axis_grid_when_selected", async () => {
  // 準備
  const root = await setUp([
    { mermaid: GANTT, data: GANTT_DATA },
    { mermaid: GIT_GRAPH, data: GIT_GRAPH_DATA },
    { mermaid: JOURNEY, data: JOURNEY_DATA },
  ]);
  const branch = () =>
    figureOf(root, 2).querySelector<HTMLButtonElement>(
      'button[data-map-branch="feat"]',
    );
  const actor = () =>
    figureOf(root, 3).querySelector<HTMLButtonElement>(
      'button[data-map-actor="AI"]',
    );
  // 実行
  hitOf(figureOf(root, 1), "des")?.click();
  branch()?.click();
  actor()?.click();
  // 検証
  expect(saved(1).selected).toEqual(["item:des"]);
  expect(saved(2).selected).toEqual(["branch:feat"]);
  expect(saved(3).selected).toEqual(["actor:AI"]);
  expect(branch()?.getAttribute("aria-pressed")).toBe("true");
  expect(actor()?.getAttribute("aria-pressed")).toBe("true");
  // 実行・検証: Esc で選択を解除する
  pressKey(hitOf(figureOf(root, 1), "des"), "Escape");
  expect(saved(1).selected).toEqual([]);
});

// 補足の layout（正常系）
test("test_attach_map_axis_grid_when_layout", async () => {
  // 準備
  const plain = await setUp([
    { mermaid: GANTT, data: GANTT_DATA },
    { mermaid: BLOCK, data: BLOCK_DATA },
  ]);
  const positionOf = (scope: HTMLElement, key: string) => {
    const style = itemOf(scope, key)?.style;
    return { left: style?.left, top: style?.top };
  };
  const tst = positionOf(figureOf(plain, 1), "tst");
  const doc = positionOf(figureOf(plain, 2), "doc");
  removeRoots();
  sessionStorage.clear();
  // 実行
  const root = await setUp([
    { mermaid: GANTT, data: GANTT_LAYOUT_DATA },
    { mermaid: BLOCK, data: BLOCK_LAYOUT_DATA },
  ]);
  // 検証
  expect(
    figureOf(root, 1)
      .querySelector('[data-map-section-toggle="公開"]')
      ?.getAttribute("aria-expanded"),
  ).toBe("false");
  expect(
    figureOf(root, 2)
      .querySelector('[data-map-section-toggle="core"]')
      ?.getAttribute("aria-expanded"),
  ).toBe("false");
  const mdmark = itemOf(figureOf(root, 2), "mdmark");
  expect(mdmark?.style.cssText).toContain("green");
  expect(positionOf(figureOf(root, 1), "tst")).toEqual(tst);
  // 閉じた core の行は低くなるため、doc は列の位置（x 座標）だけを比べる
  expect(positionOf(figureOf(root, 2), "doc").left).toBe(doc.left);
});

// 再生（正常系）
test("test_attach_map_axis_grid_when_played", async () => {
  // 準備
  const root = await setUp([
    { mermaid: GIT_GRAPH, data: GIT_GRAPH_DATA },
    { mermaid: GANTT, data: GANTT_DATA },
  ]);
  // 実行
  pressSegment(figureOf(root, 1), 6);
  // 検証
  const git = figureOf(root, 1);
  expect(
    git.closest(".mdmark-map")?.querySelector(".map-band-title")?.textContent,
  ).toBe("develop · c6");
  for (const item of git.querySelectorAll<HTMLElement>(".map-axis-item")) {
    expect(item.classList.contains("map-dim")).toBe(item.dataset.node !== "c6");
  }
  // 実行・検証: 閉じた「公開」の中のタスクは「公開」を強調する
  figureOf(root, 2)
    .querySelector<HTMLButtonElement>('[data-map-section-toggle="公開"]')
    ?.click();
  pressSegment(figureOf(root, 2), 7);
  const gantt = figureOf(root, 2);
  for (const item of gantt.querySelectorAll<HTMLElement>(".map-axis-item")) {
    expect(item.classList.contains("map-dim")).toBe(
      item.dataset.node !== "公開",
    );
  }
});
