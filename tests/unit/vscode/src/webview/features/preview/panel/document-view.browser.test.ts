import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DiffSource } from "../../../../../../../../src/diff/source.ts";
import {
  createMdmark,
  createRoot,
  renderMessage,
  scroller,
} from "../../../webview-helpers.ts";

/** 描いた文書を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDocumentView = () =>
  import(
    "../../../../../../../../vscode/src/webview/features/preview/panel/document-view.ts"
  );

/** 画面に収まらない高さの本文を入れるために使う、幅 1 の画像 */
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** 再生できる 3 秒の webm（VP8） */
const SHORT_WEBM = new URL(
  "../../../../../../helpers/media/short.webm",
  import.meta.url,
).href;

const placed: HTMLElement[] = [];

/** 描く先を包む要素と描く先の要素を置き、描いた文書を作る。`mdmark` を渡すと配布物を受けた後の view にする */
const createView = async (
  mdmark: unknown,
  options: { savedLine?: number } = {},
) => {
  const { createDocumentView } = await loadDocumentView();
  const root = createRoot(placed);
  const element = document.createElement("div");
  root.append(element);
  const view = createDocumentView({
    root,
    ...(mdmark === undefined
      ? {}
      : {
          mdmark: mdmark as Parameters<typeof createDocumentView>[0]["mdmark"] &
            object,
        }),
    ...options,
  });
  view.attach(element);
  return { view, root, element };
};

beforeEach(() => {
  document.body.style.margin = "0";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  scroller().scrollTop = 0;
  for (const element of placed.splice(0)) {
    element.remove();
  }
});

// 初回は mount、同じ設定の次の回は update（正常系）
test("test_render", async () => {
  // 準備
  const { mdmark, record } = createMdmark();
  const { view } = await createView(mdmark);
  // 実行
  view.render(renderMessage("# 1 回目"));
  view.render(renderMessage("# 2 回目"));
  // 検証
  expect(record.mount).toHaveBeenCalledTimes(1);
  expect(record.update).toHaveBeenCalledTimes(1);
  expect(record.update).toHaveBeenCalledWith("# 2 回目");
  expect(record.destroy).not.toHaveBeenCalled();
});

// 設定が変わったら destroy してから mount し直し、スクロールの位置を保つ（正常系）
test("test_render_when_config_changed", async () => {
  // 準備
  const { mdmark, record } = createMdmark();
  const { view } = await createView(mdmark);
  view.render(renderMessage("# 本文"));
  scroller().scrollTop = 200;
  expect(scroller().scrollTop).toBe(200);
  const config = { features: { callout: false } };
  // 実行
  view.render(renderMessage("# 本文", { config }));
  // 検証
  expect(record.destroy).toHaveBeenCalledTimes(1);
  expect(record.mount).toHaveBeenCalledTimes(2);
  const secondCall = record.mount.mock.calls[1] as unknown[];
  expect(secondCall[1]).toMatchObject({ config });
  expect(record.destroy.mock.invocationCallOrder[0]).toBeLessThan(
    record.mount.mock.invocationCallOrder[1] ?? 0,
  );
  expect(scroller().scrollTop).toBe(200);
});

// 配色を固定するときだけ包む要素に class を付ける（正常系）
test("test_render_when_theme", async () => {
  // 準備
  const { mdmark } = createMdmark();
  const { view, root } = await createView(mdmark);
  // 実行
  view.render(renderMessage("# 本文", { theme: "dark" }));
  const fixed = [...root.classList];
  view.render(renderMessage("# 本文", { theme: "auto" }));
  const released = [...root.classList];
  // 検証
  expect(fixed).toContain("mdmark-theme-dark");
  expect(released.filter((name) => name.startsWith("mdmark-theme-"))).toEqual(
    [],
  );
});

// previous を持つ render では取り出し元を渡して blocks で描き、次の render では取り出し元の全文を書き換えてから update する（正常系）
test("test_render_when_diff", async () => {
  // 準備
  const { mdmark, record } = createMdmark();
  const { view } = await createView(mdmark);
  /** `update` が呼ばれた時点の取り出し元の全文（変更後・変更前） */
  let contentsAtUpdate: Promise<string[]> | undefined;
  record.update.mockImplementation(() => {
    const options = record.mount.mock.calls[0]?.[1] as {
      diffSource: DiffSource;
    };
    contentsAtUpdate = Promise.all(
      ["modified", "original"].map((revisionId) =>
        options.diffSource.content({ docId: "diff", revisionId }),
      ),
    );
  });
  // 実行: 1 回目
  view.render(renderMessage("A2", { previous: "A1" }));
  // 検証
  const options = record.mount.mock.calls[0]?.[1] as {
    docId: string;
    diffMode: string;
    diffSource: DiffSource;
  };
  expect(options).toMatchObject({ docId: "diff", diffMode: "blocks" });
  const revisions = await options.diffSource.revisions("diff");
  expect(revisions.map((revision) => revision.id)).toEqual([
    "modified",
    "original",
  ]);
  // 実行: 2 回目（設定は同じ）
  view.render(renderMessage("A3", { previous: "A1" }));
  // 検証
  expect(record.mount).toHaveBeenCalledTimes(1);
  expect(record.update).toHaveBeenCalledWith("A3");
  expect(await contentsAtUpdate).toEqual(["A3", "A1"]);
});

// 保存した行を持つ view は、最初の render の後だけその行へ戻し、自分が起こしたスクロールとして捨てる（正常系）
test("test_render_when_saved_line", async () => {
  // 準備
  const { mdmark } = createMdmark();
  const { view } = await createView(mdmark, { savedLine: 20 });
  // 実行: 1 回目
  view.render(renderMessage("# 1 回目"));
  const restored = scroller().scrollTop;
  const own = view.takeScroll();
  // scrollToLine(20) で置く位置と比べる（同じ位置なら動かない）
  view.scrollToLine(20);
  const placedAt = scroller().scrollTop;
  // 実行: 2 回目（設定は同じ）
  scroller().scrollTop = 100;
  view.render(renderMessage("# 2 回目"));
  // 検証
  expect(restored).toBeGreaterThan(0);
  expect(restored).toBe(placedAt);
  expect(own).toBeUndefined();
  expect(scroller().scrollTop).toBe(100);
});

// 配布物を受ける前は描かない（異常系）
test("test_render_when_not_loaded", async () => {
  // 準備
  const { view } = await createView(undefined);
  // 実行・検証
  expect(() => view.render(renderMessage("# 本文"))).toThrow(
    "mdmark の配布物を読む前に render を受けた",
  );
});

// 外すと描画を destroy し、次の render で mount し直す（正常系）
test("test_detach", async () => {
  // 準備
  const { mdmark, record } = createMdmark();
  const { view, element } = await createView(mdmark);
  view.render(renderMessage("# 本文"));
  // 実行
  view.detach();
  view.attach(element);
  view.render(renderMessage("# 本文"));
  // 検証
  expect(record.destroy).toHaveBeenCalledTimes(1);
  expect(record.mount).toHaveBeenCalledTimes(2);
});

// 自分が動かしたスクロールの知らせだけを捨てる（正常系）
test("test_take_scroll_when_own_scroll", async () => {
  // 準備
  const { mdmark, record } = createMdmark();
  const { view } = await createView(mdmark);
  view.render(renderMessage("# 本文"));
  view.scrollToLine(20);
  // 実行
  const own = view.takeScroll();
  // 別の位置（10 行目のブロックの先頭）へ動かす
  const tenth = record.elements[0]?.querySelector('[data-source-line="10"]');
  scroller().scrollTop =
    (tenth?.getBoundingClientRect().top ?? 0) + scroller().scrollTop;
  const moved = view.takeScroll();
  // 検証
  expect(own).toBeUndefined();
  expect(moved).toBe(10);
});

// 描く前は行を返さず、描いた後は先頭の行を返す（正常系）
test("test_current_line", async () => {
  // 準備
  const { mdmark } = createMdmark();
  const { view } = await createView(mdmark);
  // 実行
  const beforeRender = view.currentLine();
  view.render(renderMessage("# 本文"));
  view.scrollToLine(20);
  const afterRender = view.currentLine();
  // 検証
  expect(beforeRender).toBeUndefined();
  expect(afterRender).toBe(20);
});

// 描く前は位置を返さず、描いた後は行の途中の位置を切り捨てずに返す（正常系）
test("test_current_position", async () => {
  // 準備
  const { mdmark } = createMdmark();
  const { view } = await createView(mdmark);
  // 実行
  const beforeRender = view.currentPosition();
  view.render(renderMessage("# 本文"));
  view.scrollToLine(20.5);
  const afterRender = view.currentPosition();
  const line = view.currentLine();
  // 検証
  expect(beforeRender).toBeUndefined();
  expect(afterRender).toBeDefined();
  expect(Math.abs((afterRender ?? 0) - 20.5)).toBeLessThan(0.05);
  expect(line).toBe(20);
});

// 属性・文字・画像の幅・位置を返す（正常系）
test("test_inspect", async () => {
  // 準備
  const { mdmark } = createMdmark();
  const { view } = await createView(mdmark);
  const holder = document.createElement("div");
  holder.innerHTML = `<h1 id="a" class="x">題</h1><img alt="図" src="${PNG_1X1}">`;
  document.body.append(holder);
  placed.push(holder);
  await (holder.querySelector("img") as HTMLImageElement).decode();
  // 実行
  const [heading, image] = await view.inspect("h1, img");
  // 検証
  expect(heading?.tagName).toBe("h1");
  expect(heading?.className).toBe("x");
  expect(heading?.attributes.id).toBe("a");
  expect(heading?.text).toBe("題");
  expect(heading?.naturalWidth).toBeUndefined();
  expect(image?.tagName).toBe("img");
  expect(image?.naturalWidth).toBe(1);
  for (const element of [heading, image]) {
    expect(typeof element?.top).toBe("number");
    expect(typeof element?.height).toBe("number");
  }
});

// 動画を再生してから調べる（正常系）
test("test_inspect_when_play", async () => {
  // 準備
  const { mdmark } = createMdmark();
  const { view } = await createView(mdmark);
  const holder = document.createElement("div");
  holder.innerHTML = `<video src="${SHORT_WEBM}" preload="auto"></video>`;
  document.body.append(holder);
  placed.push(holder);
  // 実行
  const [video] = await view.inspect("video", true);
  // 検証
  expect(video?.tagName).toBe("video");
  expect(video?.currentTime).toBeGreaterThanOrEqual(0.5);
});

// axe の違反を ID・影響度・セレクタにして返す（正常系）
test("test_audit", async () => {
  // 準備: `fixtures/preview.js` の script を置き、隣の `fixtures/test/axe.js` を axe-core の代役にする
  const { mdmark } = createMdmark();
  const { view, root, element } = await createView(mdmark);
  const script = document.createElement("script");
  script.type = "module";
  script.src = new URL("../../../fixtures/preview.js", import.meta.url).href;
  document.head.append(script);
  try {
    // 実行
    const violations = await view.audit();
    // 検証
    expect(violations).toEqual([
      { id: "color-contrast", impact: "serious", targets: ["#a"] },
    ]);
    const runs = (globalThis as { __mdmarkAxeRuns?: unknown[] })
      .__mdmarkAxeRuns;
    expect(runs).toEqual([{ include: [root], exclude: [element] }]);
  } finally {
    script.remove();
  }
});
