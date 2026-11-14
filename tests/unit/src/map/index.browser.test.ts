import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { CONFIG, DATA, FLOW, mapRange, SEQUENCE } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** dist/map.js の入口を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMap = () => import("../../../../src/map/index.ts");
const loadConfig = () => import("../../../../src/config.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) detach();
  vi.useRealTimers();
  vi.restoreAllMocks();
  removeRoots();
  sessionStorage.clear();
});

/** map の範囲を描いた文書に attachMap を付ける */
async function attach(markdown: string) {
  const { attachMap } = await loadMap();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(renderDoc(markdown).html);
  const detach = attachMap(root, resolveConfig({ config: { map: CONFIG } }));
  detachers.push(detach);
  return { root, detach };
}

// 構成図とシーケンス図（正常系）
test("test_attach_map", async () => {
  // 準備・実行
  const { root, detach } = await attach(
    `${mapRange({ mermaid: FLOW, data: DATA })}\n${mapRange({ mermaid: SEQUENCE })}`,
  );
  // 検証
  expect(
    root.querySelectorAll('figure.mdmark-diagram[data-diagram="map"]'),
  ).toHaveLength(2);
  detach();
  detachers.pop();
  const node = root.querySelector<HTMLElement>("[data-node]");
  node?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  expect(node?.hasAttribute("data-selected")).toBe(false);
});

// 折りたたみ（正常系）
test("test_attach_map_when_collapse", async () => {
  // 準備・実行
  const { root } = await attach(
    mapRange({
      args: '{"title": "全体", "collapse": {"open": false}}',
      mermaid: FLOW,
    }),
  );
  // 検証
  const details = root.querySelector("details");
  expect(details?.hasAttribute("open")).toBe(false);
  expect(details?.querySelector("summary")?.textContent?.trim()).toBe("全体");
  expect(details?.querySelector('figure[data-diagram="map"]')).not.toBeNull();
});

// 書き方の誤り（異常系）
test("test_attach_map_when_problems", async () => {
  // 準備・実行
  const { root } = await attach(
    mapRange({
      mermaid: "flowchart LR\n  A --> B\n  A -> B\n",
      data: '{"version": 1, "layuot": {}}',
    }),
  );
  // 検証
  const warnings = root.querySelectorAll(".mdmark-syntax-warning");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.textContent).toContain("A -> B");
  expect(warnings[0]?.textContent).toContain("layuot");
  expect(
    warnings[0]?.nextElementSibling?.matches(".mdmark-map, figure, details"),
  ).toBe(true);
});

// 補足の定義の無い注記の参照（異常系）
test("test_attach_map_when_annotation_undefined", async () => {
  // 準備
  const markdown = `${mapRange({
    mermaid: FLOW,
    data: '{"version": 1, "notes": {"mount": {"annotations": ["cond", "gone"]}}}',
  })}\n※[cond]: 条件の補足\n`;
  const { attachMap } = await loadMap();
  const { resolveConfig } = await loadConfig();
  const config = resolveConfig({ config: { map: CONFIG } });
  // 実行
  const { root } = await attach(markdown);
  const off = createRootFromHtml(
    renderDoc(markdown, { annotations: false }).html,
  );
  detachers.push(attachMap(off, config));
  // 検証
  const warnings = root.querySelectorAll(".mdmark-syntax-warning");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.textContent).toContain("gone");
  expect(warnings[0]?.textContent).not.toContain("※[cond]");
  expect(off.querySelectorAll(".mdmark-syntax-warning")).toHaveLength(0);
});

// 構成図に無い再生の相手（正常系）
test("test_attach_map_when_missing_participant", async () => {
  // 準備・実行
  const sequence = `${SEQUENCE}  ghost->>mount: 外からの呼び出し\n`;
  const { root } = await attach(
    `${mapRange({ mermaid: FLOW, data: DATA })}\n${mapRange({ mermaid: sequence, data: '{"version": 1, "plays_over": 1}' })}`,
  );
  // 検証
  const figures = root.querySelectorAll("figure.mdmark-diagram");
  expect(figures).toHaveLength(2);
  const warnings = [...root.querySelectorAll(".mdmark-syntax-warning")];
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.textContent).toContain("ghost");
  expect(
    (warnings[0] as Element).compareDocumentPosition(figures[1] as Element) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

// 再生で構成図をスクロールする（正常系）
test("test_attach_map_when_auto_follow", async () => {
  // 準備
  vi.useFakeTimers();
  const { root } = await attach(
    `${mapRange({ mermaid: FLOW, data: DATA })}\n${mapRange({ mermaid: SEQUENCE, data: '{"version": 1, "plays_over": 1}' })}`,
  );
  const [flow, seq] = [...root.querySelectorAll("figure.mdmark-diagram")];
  const viewport = flow?.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});
  // 実行
  seq?.querySelector<HTMLButtonElement>('[data-band="auto"]')?.click();
  vi.advanceTimersByTime(2000);
  // 検証
  expect(scrollTo).toHaveBeenCalledTimes(1);
  // 実行
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  scrollTo.mockClear();
  vi.advanceTimersByTime(2000);
  // 検証
  expect(scrollTo).not.toHaveBeenCalled();
});
