import { afterEach, expect, test } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import { CONFIG, DATA, FLOW, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** 一覧の項目の作成を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadList = () => import("../../../../src/map/list.ts");
const loadFlowchart = () => import("../../../../src/map/flowchart.ts");
const loadSequence = () => import("../../../../src/map/sequence.ts");
/** 構成図を付ける処理を読み込む（一覧の表示は attachMapFlow が attachMapList で付ける） */
const loadFlowView = () => import("../../../../src/map/flow-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
});

/** 構成図を描いて付ける */
async function setUp() {
  addStyles();
  const { attachMapFlow } = await loadFlowView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: FLOW, data: DATA })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapFlow(range, resolveConfig({ config: { map: CONFIG } }), {
      args: parseMapArgs("").args,
    }),
  );
  return range;
}

/** キーを押す */
const press = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

/** 隠れていない項目 */
const visibleItems = (range: HTMLElement) =>
  [...range.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter(
    (item) => item.closest("[hidden]") === null,
  );

// 切り替えと戻し（正常系）
test("test_attach_map_list", async () => {
  // 準備
  const range = await setUp();
  const viewport = range.querySelector<HTMLElement>(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  range.querySelector<HTMLButtonElement>('button[aria-label="拡大"]')?.click();
  viewport.scrollLeft = 40;
  const zoom = range.querySelector(".mdmark-diagram-zoom")?.textContent;
  const left = viewport.scrollLeft;
  const button = range.querySelector<HTMLButtonElement>(
    '[data-tool="list"]',
  ) as HTMLButtonElement;
  // 実行
  button.click();
  const opened = {
    pressed: button.getAttribute("aria-pressed"),
    tree: range.querySelector('[role="tree"]') !== null,
    hidden: range.querySelector<HTMLElement>(".mdmark-diagram-sizer")?.hidden,
    focused: document.activeElement === visibleItems(range)[0],
  };
  button.click();
  // 検証
  expect(opened).toEqual({
    pressed: "true",
    tree: true,
    hidden: true,
    focused: true,
  });
  expect(range.querySelector('[role="tree"]')).toBeNull();
  expect(
    range.querySelector<HTMLElement>(".mdmark-diagram-sizer")?.hidden,
  ).toBe(false);
  expect(range.querySelector(".mdmark-diagram-zoom")?.textContent).toBe(zoom);
  expect(viewport.scrollLeft).toBe(left);
});

// キー操作（正常系）
test("test_attach_map_list_when_keyboard", async () => {
  // 準備
  const range = await setUp();
  range.querySelector<HTMLButtonElement>('[data-tool="list"]')?.click();
  const tabbable = () =>
    range.querySelectorAll('[role="treeitem"][tabindex="0"]').length;
  // 実行・検証
  const first = visibleItems(range)[0] as HTMLElement;
  press(first, "ArrowDown");
  expect(document.activeElement).toBe(visibleItems(range)[1]);
  expect(tabbable()).toBe(1);
  const group = range.querySelector<HTMLElement>(
    '[role="treeitem"][data-id="lib"]',
  ) as HTMLElement;
  group.focus();
  press(group, "ArrowLeft");
  expect(group.getAttribute("aria-expanded")).toBe("false");
  expect(visibleItems(range).some((item) => item.dataset.id === "mount")).toBe(
    false,
  );
  press(group, "ArrowRight");
  expect(group.getAttribute("aria-expanded")).toBe("true");
  press(group, "End");
  const items = visibleItems(range);
  expect(document.activeElement).toBe(items[items.length - 1]);
  expect(tabbable()).toBe(1);
});

// 入れ子と出る線（正常系）
test("test_flow_list_items", async () => {
  // 準備
  const { flowListItems } = await loadList();
  const { parseFlowchart } = await loadFlowchart();
  const chart = parseFlowchart(FLOW);
  // 実行
  const items = flowListItems({
    chart,
    notes: { data: "補足のキーと値を点検する" },
    changes: { mount: "changed" },
    kindLabel: (node) => {
      const kind = chart.nodes.find((item) => item.id === node)?.classes[0];
      return kind === undefined
        ? undefined
        : (CONFIG.kinds as Record<string, { label: string }>)[kind]?.label;
    },
  });
  // 検証
  type Item = (typeof items)[number];
  const pick = (list: Item[] | undefined, id: string): Item | undefined =>
    (list ?? []).find((item) => item.id === id);
  const lib = pick(items, "lib");
  const read = pick(lib?.children, "read");
  expect(read).toBeDefined();
  expect(pick(items, "user")?.out).toEqual(["→ mount（設定と Markdown）"]);
  expect(pick(lib?.children, "mount")?.change).toBe("changed");
  expect(pick(read?.children, "data")?.note).toBe("補足のキーと値を点検する");
});

// 記載順のメッセージ（正常系）
test("test_sequence_list_items", async () => {
  // 準備
  const { sequenceListItems } = await loadList();
  const { parseSequence } = await loadSequence();
  const sequence = parseSequence(
    "sequenceDiagram\n  participant a as 画面\n  participant b as API\n  participant c as DB\n  a->>b: OK\n  b->>c: 保存\n  c-->>b: 結果\n  a->>b: OK\n",
  );
  // 実行
  const items = sequenceListItems(sequence);
  // 検証
  expect(items.map((item) => item.id)).toEqual(["1", "2", "3", "4"]);
  expect(items[0]?.name).toBe("画面 → API: OK");
  expect(items[3]?.name).toBe("画面 → API: OK");
  expect(items[0]?.id).not.toBe(items[3]?.id);
});
