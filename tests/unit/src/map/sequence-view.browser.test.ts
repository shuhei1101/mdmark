import { afterEach, expect, test } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import { CONFIG, mapRange, SEQUENCE } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** シーケンス図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSequenceView = () => import("../../../../src/map/sequence-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** sessionStorage に保った 1 つ目の図の状態 */
const saved = () =>
  JSON.parse(
    sessionStorage.getItem(`mdmark-map:${location.pathname}#1`) ?? "{}",
  );

/** シーケンス図を描いて付ける */
async function setUp() {
  const { attachMapSequence } = await loadSequenceView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: SEQUENCE })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapSequence(range, resolveConfig({ config: { map: CONFIG } }), {
      args: parseMapArgs("").args,
    }),
  );
  return root;
}

// Alt + →（正常系）
test("test_attach_map_sequence_when_reorder", async () => {
  // 準備
  const root = await setUp();
  const first = root.querySelector<HTMLElement>(
    '[data-participant="user"]',
  ) as HTMLElement;
  // 実行
  first.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
    }),
  );
  // 検証
  expect(saved().order?.slice(0, 2)).toEqual(["mount", "user"]);
});

// 中だけを描く（正常系）
test("test_attach_map_sequence_when_enter_block", async () => {
  // 準備
  const root = await setUp();
  // 実行
  root
    .querySelector<HTMLButtonElement>(
      'button[aria-label="loop「map の範囲ごと」の中だけを見る"]',
    )
    ?.click();
  // 検証
  expect(saved().entered).toBe("1");
  const shown = [...root.querySelectorAll("[data-participant]")].map((item) =>
    item.getAttribute("data-participant"),
  );
  expect(shown).toEqual(["mount", "marker", "mermaid", "layout"]);
});

// 選んだ参加者の印（正常系）
test("test_attach_map_sequence_when_packets", async () => {
  // 準備
  const root = await setUp();
  const head = root.querySelector<HTMLElement>(
    '.map-participant[data-participant="mount"]',
  ) as HTMLElement;
  // 実行
  head.click();
  // 検証
  const lines = [...root.querySelectorAll(".map-packet[data-message]")].map(
    (item) => Number(item.getAttribute("data-message")),
  );
  expect(lines.length).toBeGreaterThan(0);
  const { parseSequence } = await import("../../../../src/map/sequence.ts");
  const { SEQUENCE: source } = await import("../../helpers/map.ts");
  const messages = parseSequence(source).messages;
  for (const at of lines) {
    const message = messages[at];
    expect(message?.from === "mount" || message?.to === "mount").toBe(true);
  }
});

// 並べ替えのドラッグを pointercancel で止めたとき、並び順を変えない（正常系）
test("test_attach_map_sequence_when_reorder_cancelled", async () => {
  // 準備: 参加者を列に並べるため、描いた文書の CSS を読み込む
  addStyles();
  const root = await setUp();
  const heads = [...root.querySelectorAll<HTMLElement>(".map-participant")];
  const first = heads[0] as HTMLElement;
  const fourth = heads[3] as HTMLElement;
  const start = first.getBoundingClientRect();
  const goal = fourth.getBoundingClientRect();
  const point = (x: number) => ({
    bubbles: true,
    pointerId: 1,
    button: 0,
    pointerType: "touch",
    clientX: x,
    clientY: start.y + 2,
  });
  // 実行: 4 人目の列まで動かしてから pointercancel、続けて pointerup
  first.dispatchEvent(new PointerEvent("pointerdown", point(start.x + 2)));
  window.dispatchEvent(
    new PointerEvent("pointermove", point(goal.x + goal.width / 2)),
  );
  window.dispatchEvent(
    new PointerEvent("pointercancel", point(goal.x + goal.width / 2)),
  );
  window.dispatchEvent(
    new PointerEvent("pointerup", point(goal.x + goal.width / 2)),
  );
  // 検証
  expect(saved().order).toBeUndefined();
  expect(root.querySelector(".map-insert-line")).toBeNull();
  expect(
    root.querySelector<HTMLElement>('[data-participant="user"]')?.style
      .translate,
  ).toBe("");
});
