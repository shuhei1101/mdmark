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

// 再生で構成図を移す（正常系）
test("test_attach_map_when_played_follow", async () => {
  // 準備
  const { zoomControlOf } = await import(
    "../../../../src/shared/zoom.interact.ts"
  );
  const { root } = await attach(
    `${mapRange({ mermaid: FLOW, data: DATA })}\n${mapRange({ mermaid: SEQUENCE, data: '{"version": 1, "plays_over": 1}' })}`,
  );
  const [flow, seq] = [...root.querySelectorAll("figure.mdmark-diagram")];
  const viewport = flow?.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const zoom = zoomControlOf(viewport);
  if (!zoom) {
    throw new Error("拡大・縮小が付いていない");
  }
  const focusRect = vi.spyOn(zoom, "focusRect").mockImplementation(() => {});
  /** 帯を描き直した後の区切りを引く */
  const segment = (index: number) =>
    seq?.closest(".mdmark-map")?.querySelectorAll<HTMLElement>(".map-band-seg")[
      index
    ];
  // 実行
  segment(0)?.click();
  // 検証
  expect(focusRect).toHaveBeenCalledTimes(1);
  // 実行
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  segment(1)?.click();
  // 検証
  expect(focusRect).toHaveBeenCalledTimes(2);
});

// 範囲の外の map の図は警告を出さない（正常系）
test("test_attach_map_when_plain", async () => {
  // 準備・実行
  const { root } = await attach(
    '```mermaid\nflowchart LR\n  A[仕様] --> B[実装]\n  click A "javascript:alert(1)"\n```\n',
  );
  // 検証
  expect(
    root.querySelectorAll('figure.mdmark-diagram[data-diagram="map"]'),
  ).toHaveLength(1);
  expect(root.querySelector(".mdmark-syntax-warning")).toBeNull();
  expect(
    root.querySelector('[data-node="A"] a.mdmark-diagram-node-link'),
  ).toBeNull();
  expect(root.querySelector("a.mdmark-diagram-node-link")).toBeNull();
});

// 見た目の指定を持つ図を mermaid のコードブロックに戻す（正常系）
test("test_attach_map_when_plain_fallback", async () => {
  // 準備
  const { attachMap } = await loadMap();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(
      "```mermaid\n---\ntitle: 受付\n---\nflowchart LR\n  A --> B\n  style A fill:#f9f\n```\n\n```mermaid\nflowchart LR\n  C --> D\n```\n",
    ).html,
  );
  const restored: HTMLElement[][] = [];
  // 実行
  detachers.push(
    attachMap(root, resolveConfig({ config: { map: CONFIG } }), {
      restoreMermaid: (blocks) => restored.push(blocks),
    }),
  );
  // 検証
  const blocks = root.querySelectorAll<HTMLElement>("[data-mdmark-mermaid]");
  expect(blocks).toHaveLength(1);
  const code = blocks[0]?.querySelector("code")?.textContent ?? "";
  expect(code.startsWith("---")).toBe(true);
  expect(code).toContain("style A fill:#f9f");
  expect(restored).toHaveLength(1);
  expect(restored[0]).toEqual([blocks[0]]);
  expect(root.querySelectorAll("figure.mdmark-diagram")).toHaveLength(1);
});

// マインドマップ（正常系）
test("test_attach_map_when_mindmap", async () => {
  // 準備
  const { MINDMAP_PLAIN } = await import("../../helpers/map.ts");
  const withIcon = "mindmap\n  root\n    A\n      ::icon(fa fa-book)\n";
  // 実行
  const { root } = await attach(
    `${mapRange({ mermaid: MINDMAP_PLAIN })}\n\`\`\`mermaid\n${withIcon}\`\`\`\n`,
  );
  // 検証
  const figures = root.querySelectorAll("figure.mdmark-diagram");
  expect(figures).toHaveLength(1);
  expect(
    figures[0]?.querySelectorAll(".map-mindmap-item").length,
  ).toBeGreaterThan(0);
  const blocks = root.querySelectorAll<HTMLElement>("[data-mdmark-mermaid]");
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.querySelector("code")?.textContent).toContain("::icon");
});

// 軸と格子の配置の図（正常系）
test("test_attach_map_when_axis_grid", async () => {
  // 準備
  const samples = await import("../../helpers/map.ts");
  const sources = [
    samples.GANTT,
    samples.TIMELINE,
    samples.GIT_GRAPH,
    samples.JOURNEY,
    samples.BLOCK,
  ];
  const ranges = sources.map((mermaid) => mapRange({ mermaid })).join("\n");
  // 実行
  const { root } = await attach(
    `${ranges}\n\`\`\`mermaid\n${samples.GANTT_UNREADABLE}\`\`\`\n`,
  );
  // 検証
  const figures = [
    ...root.querySelectorAll<HTMLElement>(
      'figure.mdmark-diagram[data-diagram="map"]',
    ),
  ];
  expect(figures).toHaveLength(5);
  expect(
    figures.map(
      (figure) =>
        figure.closest<HTMLElement>(".mdmark-map")?.dataset.mapKind ??
        figure.dataset.mapKind,
    ),
  ).toEqual(["gantt", "timeline", "gitGraph", "journey", "block"]);
  const blocks = root.querySelectorAll<HTMLElement>("[data-mdmark-mermaid]");
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.querySelector("code")?.textContent).toContain("四日");
});

// id: のノードのリンク先（正常系）
test("test_attach_map_when_id_link", async () => {
  // 準備
  const { attachMap } = await loadMap();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(
      mapRange({
        mermaid:
          'flowchart LR\n  A --> B\n  click A "id:SC-1"\n  click B "id:unknown"\n',
      }),
    ).html,
  );
  // 実行
  detachers.push(
    attachMap(root, resolveConfig({ config: { map: CONFIG } }), {
      resolveIdLink: (href) =>
        href.startsWith("id:SC-")
          ? `https://docs.example.com/${href.slice("id:".length)}`
          : undefined,
    }),
  );
  // 検証
  expect(
    root
      .querySelector('[data-node="A"] a.mdmark-diagram-node-link')
      ?.getAttribute("href"),
  ).toBe("https://docs.example.com/SC-1");
  expect(
    root.querySelector('[data-node="B"] a.mdmark-diagram-node-link'),
  ).toBeNull();
  const warning = root.querySelector(".mdmark-syntax-warning");
  expect(warning?.textContent).toContain("B");
  expect(warning?.textContent).toContain("id:unknown");
});
