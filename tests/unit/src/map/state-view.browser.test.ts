import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { mapRange, STATE, STATE_DATA } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** 状態遷移図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadStateView = () => import("../../../../src/map/state-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** 状態遷移図を描いて付ける */
async function setUp(data = STATE_DATA) {
  const { attachMapState } = await loadStateView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(
      mapRange({ args: '{"title": "作業の状態"}', mermaid: STATE, data }),
    ).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapState(
      range,
      resolveConfig({}),
      parseMapArgs('{"title": "作業の状態"}').args,
    ),
  );
  return root;
}

// 形状と付け替え（正常系）
test("test_attach_map_state", async () => {
  // 準備・実行
  const root = await setUp();
  // 検証
  for (const shape of ["start", "end", "choice"]) {
    expect(
      root.querySelector(`[data-node][data-shape="${shape}"]`),
    ).not.toBeNull();
  }
  const t5 = root.querySelector<SVGPathElement>(
    'path.mdmark-diagram-wire[data-wire="t5"]',
  );
  const points =
    (t5?.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const [endX, endY] = [
    points.at(-2) ?? Number.NaN,
    points.at(-1) ?? Number.NaN,
  ];
  const start = root.querySelector<HTMLElement>(
    '[data-node="start_実行中"]',
  ) as HTMLElement;
  expect(endX).toBeGreaterThanOrEqual(start.offsetLeft - 2);
  expect(endX).toBeLessThanOrEqual(start.offsetLeft + start.offsetWidth + 2);
  expect(endY).toBeGreaterThanOrEqual(start.offsetTop - 2);
  expect(endY).toBeLessThanOrEqual(start.offsetTop + start.offsetHeight + 2);
  const loop = root.querySelector(
    '.map-state-loop[data-wire="t2"], [data-wire="t2"] .map-state-loop',
  );
  expect(loop).not.toBeNull();
  expect(root.textContent).toContain("保存する");
});

// 遷移の再生（正常系）
test("test_attach_map_state_when_played", async () => {
  // 準備
  const root = await setUp();
  const band = root.querySelector<HTMLElement>(".map-band") as HTMLElement;
  // 実行
  for (let index = 0; index < 6; index++) {
    root
      .querySelector<HTMLButtonElement>(
        '.map-band button[aria-label="次の遷移"]',
      )
      ?.click();
  }
  // 検証
  const text = root.querySelector<HTMLElement>(".map-band")?.textContent ?? "";
  expect(text).toContain("6/13");
  expect(text).toContain("判定 → 差し戻しの理由を確認する：差し戻し");
  expect(text).toContain("差し戻しの理由はコメントに残る");
  expect(band.getAttribute("aria-label")).toBe("作業の状態の再生");
  const labels = [...root.querySelectorAll(".map-band button")].map((button) =>
    button.getAttribute("aria-label"),
  );
  expect(labels).toEqual(
    expect.arrayContaining([
      "前の遷移",
      "再生をやめる",
      "自動で進める",
      "次の遷移",
    ]),
  );
});

// 案内を持つ（正常系）
test("test_attach_map_state_when_walkthroughs", async () => {
  // 準備・実行
  const root = await setUp(
    JSON.stringify({
      version: 1,
      walkthroughs: [
        { title: "書く", text: "a", nodes: ["下書き"] },
        { title: "処理する", text: "b", nodes: ["処理"], enter: "実行中" },
      ],
    }),
  );
  // 検証
  expect(root.querySelector(".map-band")?.textContent).toContain("–/2");
});
