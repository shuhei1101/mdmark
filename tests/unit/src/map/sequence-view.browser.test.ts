import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
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
    attachMapSequence(
      range,
      resolveConfig({ config: { map: CONFIG } }),
      parseMapArgs("").args,
    ),
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
