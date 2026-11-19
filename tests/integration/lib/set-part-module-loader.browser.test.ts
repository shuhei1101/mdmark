import { afterEach, expect, inject, test, vi } from "vitest";
import type { MdmarkComment, MountHandle } from "../../../src/index.ts";
import { mapRange } from "../../unit/helpers/map.ts";

type Built = typeof import("../../../src/index.ts");

/** 部品のモジュール */
type PartModule = Record<string, unknown>;

/** 部品の名前 */
type PartName = "map" | "view" | "comments";

/** map の図が描かれるまで待つ時間（dist/map.js の評価を含む） */
const MAP_WAIT_MS = 10_000;

/** map の範囲 */
const MAP_MARKDOWN = mapRange({
  mermaid: "flowchart LR\n  a[入力] --> b[出力]\n",
});

/** ビューのマーカーで囲んだ表 */
const VIEW_MARKDOWN = [
  '<!-- view: {"board": {"group": {"column": "状態"}}} -->',
  "",
  "| タイトル | 状態 |",
  "| --- | --- |",
  "| 配色を決める | 未着手 |",
  "| 余白を決める | 完了 |",
  "",
  "<!-- /view -->",
].join("\n");

/** 段落 */
const PARAGRAPH = "埋めた配布物から描いた段落。";

/** map の図の枠 */
const MAP_FIGURE = 'figure.mdmark-diagram[data-diagram="map"]';

/** map が描けない種類（pie）の mermaid のコードブロック */
const PIE_MARKDOWN = [
  "```mermaid",
  "pie title 比率",
  '  "A" : 1',
  '  "B" : 2',
  "```",
].join("\n");

/** mermaid の図の枠 */
const MERMAID_FIGURE = 'figure.mdmark-diagram[data-diagram="mermaid"]';

/** mermaid の図が描かれるまで待つ時間（mermaid の描画を含む） */
const MERMAID_WAIT_MS = 20_000;

/** 手元の mermaid の ES モジュール（依存の mermaid の dist）。利用側が 1 つのモジュールにまとめて埋めた mermaid の代わりに、テストの前に読み込んでおく */
const MERMAID_MODULE_URL = "/node_modules/mermaid/dist/mermaid.esm.min.mjs";

/** ページが設定の `mermaid.url`（`mermaid.esm.min.mjs`）か、ページと別のオリジンへ要求した回数を数える。手元の mermaid が図の種類ごとに読み込む分割したファイル（`dist/chunks/`）は、利用側が 1 つにまとめた mermaid には無いため数えない */
const mermaidUrlRequests = (): number =>
  performance
    .getEntriesByType("resource")
    .map((entry) => new URL(entry.name))
    .filter(
      (url) =>
        url.pathname.endsWith("/mermaid.esm.min.mjs") ||
        url.origin !== location.origin,
    ).length;

const elements: HTMLElement[] = [];
const handles: MountHandle[] = [];

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
const distUrl = (file: string): string =>
  `/@fs${inject("builtRoot")}/dist/${file}`;

/** ビルドした配布物のファイルの中身を Blob の URL にして読み込む（読み込むたびに別のモジュールになる）。中身は開発サーバーが書き換えない `?raw` で受け取る */
const importAsBlob = async <T>(file: string): Promise<T> => {
  const { default: source } = (await import(
    /* @vite-ignore */ `${distUrl(file)}?raw`
  )) as { default: string };
  const url = URL.createObjectURL(
    new Blob([source], { type: "text/javascript" }),
  );
  return import(/* @vite-ignore */ url) as Promise<T>;
};

/** 部品の配布ファイルを開発サーバーへ要求した回数を数える */
const partRequests = (): Record<PartName, number> => {
  const paths = performance
    .getEntriesByType("resource")
    .map((entry) => new URL(entry.name).pathname);
  const count = (file: string) =>
    paths.filter((path) => path.endsWith(`/dist/${file}`)).length;
  return {
    map: count("map.js"),
    view: count("view.js"),
    comments: count("comments.js"),
  };
};

/** 描く先の要素を作り、ページに配置する */
const createElement = (): HTMLElement => {
  const el = document.createElement("div");
  el.style.width = "1000px";
  document.body.append(el);
  elements.push(el);
  return el;
};

/** `console.error` の呼び出しに、部品の名前と条件に合うエラーがあるか */
const reportedError = (
  calls: unknown[][],
  name: PartName | "mermaid",
  matches: (error: Error) => boolean,
): boolean =>
  calls.some(
    (args) =>
      args.includes(name) &&
      args.some((arg) => arg instanceof Error && matches(arg)),
  );

/** mount が同期で投げないことを確かめて描き、後始末のために戻り値を記録する */
const mountWithoutThrow = (
  mdmark: Built,
  el: HTMLElement,
  markdown: string,
): void => {
  let handle: MountHandle | undefined;
  expect(() => {
    handle = mdmark.mount(el, { markdown });
  }).not.toThrow();
  if (handle) handles.push(handle);
};

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  for (const el of elements.splice(0)) el.remove();
  vi.restoreAllMocks();
  performance.clearResourceTimings();
});

// 指定した関数で部品を読み込み、配布物の隣へ要求せずに map・ビュー・コメントを描く（正常系）
test("test_normal", async () => {
  // 準備
  const mdmark = await importAsBlob<Built>("index.js");
  const [map, view, comments] = await Promise.all([
    importAsBlob<PartModule>("map.js"),
    importAsBlob<PartModule>("view.js"),
    importAsBlob<PartModule>("comments.js"),
  ]);
  const loaders = {
    map: vi.fn(async () => map),
    view: vi.fn(async () => view),
    comments: vi.fn(async () => comments),
  };
  const load = vi.fn(async (): Promise<MdmarkComment[]> => []);
  performance.clearResourceTimings();
  const el = createElement();
  // 実行
  const results = [
    mdmark.setPartModuleLoader("map", loaders.map),
    mdmark.setPartModuleLoader("view", loaders.view),
    mdmark.setPartModuleLoader("comments", loaders.comments),
  ];
  handles.push(
    mdmark.mount(el, {
      markdown: `${MAP_MARKDOWN}\n${VIEW_MARKDOWN}\n\n${PARAGRAPH}\n`,
      docId: "embedded",
      commentStore: {
        load,
        save: async ({ comment }) => ({ id: "c1", ...comment }),
      },
      config: { features: { comments: true } },
    }),
  );
  // 検証
  await vi.waitFor(() => expect(el.querySelector(MAP_FIGURE)).not.toBeNull(), {
    timeout: MAP_WAIT_MS,
  });
  await vi.waitFor(() =>
    expect(el.querySelector(".mdmark-view-switch")).not.toBeNull(),
  );
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  expect(loaders.map).toHaveBeenCalledTimes(1);
  expect(loaders.view).toHaveBeenCalledTimes(1);
  expect(loaders.comments).toHaveBeenCalledTimes(1);
  expect(partRequests()).toEqual({ map: 0, view: 0, comments: 0 });
  expect(results).toEqual([undefined, undefined, undefined]);
});

// 指定しなかった部品は dist/index.js の隣の配布ファイルから読み込む（正常系）
test("test_normal_when_partially_set", async () => {
  // 準備
  const mdmark = (await import(
    /* @vite-ignore */ `${distUrl("index.js")}?case=partially-set`
  )) as Built;
  const view = await importAsBlob<PartModule>("view.js");
  performance.clearResourceTimings();
  const el = createElement();
  // 実行
  mdmark.setPartModuleLoader("view", async () => view);
  handles.push(
    mdmark.mount(el, { markdown: `${MAP_MARKDOWN}\n${VIEW_MARKDOWN}\n` }),
  );
  // 検証
  await vi.waitFor(() => expect(el.querySelector(MAP_FIGURE)).not.toBeNull(), {
    timeout: MAP_WAIT_MS,
  });
  await vi.waitFor(() =>
    expect(el.querySelector(".mdmark-view-switch")).not.toBeNull(),
  );
  const requests = partRequests();
  expect(requests.map).toBeGreaterThan(0);
  expect(requests.view).toBe(0);
});

// loader が拒否する部品は描かず、console.error に出してほかを描く（異常系）
test("test_error_when_loader_rejects", async () => {
  // 準備
  const mdmark = await importAsBlob<Built>("index.js");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  // 実行
  mdmark.setPartModuleLoader("map", () => Promise.reject(new Error("missing")));
  mountWithoutThrow(mdmark, el, `${MAP_MARKDOWN}\n${PARAGRAPH}\n`);
  // 検証
  expect(el.textContent).toContain(PARAGRAPH);
  await vi.waitFor(() =>
    expect(
      reportedError(
        error.mock.calls,
        "map",
        (reason) => reason.message === "missing",
      ),
    ).toBe(true),
  );
});

// 部品の関数を export しないモジュールを返却した部品は描かず、console.error に出す（異常系）
test("test_error_when_shape_mismatch", async () => {
  // 準備
  const mdmark = await importAsBlob<Built>("index.js");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  // 実行
  mdmark.setPartModuleLoader("view", async () => ({}));
  mountWithoutThrow(mdmark, el, `${VIEW_MARKDOWN}\n\n${PARAGRAPH}\n`);
  // 検証
  expect(el.textContent).toContain(PARAGRAPH);
  await vi.waitFor(() =>
    expect(
      reportedError(error.mock.calls, "view", (reason) =>
        reason.message.includes("drawView"),
      ),
    ).toBe(true),
  );
});

// 配布物を埋めたページで指定しなかった部品は、隣の URL を作れずに描かず、console.error に出してほかを描く（異常系）
test("test_error_when_url_unresolvable", async () => {
  // 準備
  const mdmark = await importAsBlob<Built>("index.js");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  performance.clearResourceTimings();
  const el = createElement();
  // 実行
  mountWithoutThrow(mdmark, el, `${MAP_MARKDOWN}\n${PARAGRAPH}\n`);
  // 検証
  expect(el.textContent).toContain(PARAGRAPH);
  await vi.waitFor(() =>
    expect(
      reportedError(
        error.mock.calls,
        "map",
        (reason) => reason instanceof TypeError && reason.cause === "map.js",
      ),
    ).toBe(true),
  );
  expect(partRequests()).toEqual({ map: 0, view: 0, comments: 0 });
});

// 名前か関数が誤っている呼び出しは記録せずに TypeError を投げる（異常系）
test("test_error_when_args_invalid", async () => {
  // 準備
  const mdmark = (await import(
    /* @vite-ignore */ `${distUrl("index.js")}?case=args-invalid`
  )) as Built;
  const set = mdmark.setPartModuleLoader as (
    name: unknown,
    loader: unknown,
  ) => void;
  const el = createElement();
  // 実行・検証
  expect(() => set("chart", async () => ({}))).toThrow(TypeError);
  expect(() => set("chart", async () => ({}))).toThrow(/name/);
  expect(() => set("map", "map.js")).toThrow(TypeError);
  expect(() => set("map", "map.js")).toThrow(/loader/);
  handles.push(mdmark.mount(el, { markdown: MAP_MARKDOWN }));
  await vi.waitFor(() => expect(el.querySelector(MAP_FIGURE)).not.toBeNull(), {
    timeout: MAP_WAIT_MS,
  });
});

// 指定した関数で mermaid を読み込み、mermaid.url へ要求せずに mermaid の図を描く（正常系）
test("test_normal_when_mermaid_set", async () => {
  // 準備
  const mdmark = await importAsBlob<Built>("index.js");
  const mermaid = (await import(
    /* @vite-ignore */ MERMAID_MODULE_URL
  )) as PartModule;
  const loader = vi.fn(async () => mermaid);
  performance.clearResourceTimings();
  const el = createElement();
  // 実行
  mdmark.setPartModuleLoader("mermaid", loader);
  handles.push(
    mdmark.mount(el, { markdown: `${PIE_MARKDOWN}\n\n${PARAGRAPH}\n` }),
  );
  // 検証
  await vi.waitFor(
    () => expect(el.querySelector(MERMAID_FIGURE)).not.toBeNull(),
    { timeout: MERMAID_WAIT_MS },
  );
  expect(el.querySelector(`${MERMAID_FIGURE} svg`)).not.toBeNull();
  expect(loader).toHaveBeenCalledTimes(1);
  expect(mermaidUrlRequests()).toBe(0);
});

// mermaid の loader が拒否するか構造が合わないときは、mermaid を読み込めないときと同じく描き、mermaid.url へ要求しない（異常系）
test("test_error_when_mermaid_loader_fails", async () => {
  const loaders = [
    () => Promise.reject(new Error("missing")),
    async () => ({ default: {} }),
  ];
  for (const loader of loaders) {
    // 準備: ページごとに別の配布物を読み込む
    const mdmark = await importAsBlob<Built>("index.js");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    performance.clearResourceTimings();
    const el = createElement();
    // 実行
    mdmark.setPartModuleLoader("mermaid", loader);
    mountWithoutThrow(mdmark, el, `${PIE_MARKDOWN}\n\n${PARAGRAPH}\n`);
    // 検証
    expect(el.textContent).toContain(PARAGRAPH);
    await vi.waitFor(() => {
      const block = el.querySelector<HTMLElement>("[data-mdmark-mermaid]");
      expect(block?.hidden).toBe(false);
      expect(
        block?.previousElementSibling?.classList.contains("mdmark-notice"),
      ).toBe(true);
    });
    expect(reportedError(error.mock.calls, "mermaid", () => true)).toBe(true);
    expect(el.querySelector(MERMAID_FIGURE)).toBeNull();
    expect(mermaidUrlRequests()).toBe(0);
    error.mockRestore();
  }
});
