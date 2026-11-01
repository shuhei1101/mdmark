import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { DiffSource } from "../../../../../src/diff/source.ts";

/** パネルの中の入口を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPreview = () =>
  import("../../../../../vscode/src/webview/preview.ts");

/** 縦に積んだブロックの高さ（px） */
const BLOCK_HEIGHT = 100;
/** 縦に積んだブロックの数 */
const BLOCK_COUNT = 40;
/** 画面に収まらない高さの本文を入れるために使う、幅 1 の画像 */
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** 再生できる 3 秒の webm（VP8） */
const SHORT_WEBM = new URL(
  "../../../../helpers/media/short.webm",
  import.meta.url,
).href;

const placed: HTMLElement[] = [];

/** `startPreview` が `window`・`document` に付けた受け取り（次のテストの `message` に反応しないよう、テストの後に外す） */
const listeners: {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options: boolean | AddEventListenerOptions | undefined;
}[] = [];

/** `target` に付けた受け取りを控える */
function trackListeners(target: EventTarget): void {
  const add = target.addEventListener.bind(target);
  vi.spyOn(target, "addEventListener").mockImplementation(
    (type, listener, options) => {
      if (listener !== null) {
        listeners.push({ target, type, listener, options });
      }
      add(type, listener, options);
    },
  );
}

/** `mount` の代役が描いた先の要素と戻り値の記録 */
type MountRecord = {
  mount: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  elements: HTMLElement[];
};

/** `mount` と戻り値の `update`・`destroy` を記録する mdmark の代役を作る */
function createMdmark(): { mdmark: { mount: never }; record: MountRecord } {
  const elements: HTMLElement[] = [];
  const update = vi.fn();
  const destroy = vi.fn((): void => {
    // 描いた本文を片付ける
    for (const element of elements) {
      element.replaceChildren();
    }
  });
  const mount = vi.fn((element: HTMLElement) => {
    elements.push(element);
    // 元の行番号を持つブロックを縦に積み、画面に収まらない本文にする
    for (let line = 0; line < BLOCK_COUNT; line += 1) {
      const blockElement = document.createElement("div");
      blockElement.dataset.sourceLine = String(line);
      blockElement.style.height = `${BLOCK_HEIGHT}px`;
      element.append(blockElement);
    }
    return { update, destroy };
  });
  return {
    mdmark: { mount } as unknown as { mount: never },
    record: { mount, update, destroy, elements },
  };
}

/** 描く先を包む要素をページに置く */
function createRoot(): HTMLElement {
  const root = document.createElement("div");
  root.id = "mdmark-preview";
  root.dataset.configPath = "mdmark.config.yaml";
  document.body.append(root);
  placed.push(root);
  return root;
}

/** パネルの表示を作る。`savedLine` を渡すと、作り直した Webview が `getState` で読んだ行を持つ view にする */
async function createView(
  mdmark: unknown,
  root = createRoot(),
  options: { savedLine?: number } = {},
) {
  const { PreviewView } = await loadPreview();
  const view = new PreviewView({
    root,
    mdmark: mdmark as ConstructorParameters<typeof PreviewView>[0]["mdmark"],
    ...options,
  });
  return { view, root };
}

/** `render` のメッセージを作る */
function renderMessage(
  markdown: string,
  options: {
    config?: Record<string, unknown>;
    theme?: "auto" | "light" | "dark";
    previous?: string;
  } = {},
) {
  return {
    type: "render" as const,
    markdown,
    ...(options.previous === undefined ? {} : { previous: options.previous }),
    config: options.config ?? {},
    theme: options.theme ?? "auto",
  };
}

/** 画面がスクロールする要素 */
function scroller(): Element {
  return document.scrollingElement ?? document.documentElement;
}

/** 描画の次のフレームまで待つ（`scroll` の知らせを 1 フレームにまとめる処理を通す） */
async function nextFrames(count = 2): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** `startPreview` が `import()` で読む配布物の代役で縦に積むブロックの数（元の行番号 30 を先頭に置けるだけの高さにする） */
const MODULE_BLOCK_COUNT = 80;

/** 元の行番号を持つブロックを縦に積んで描く `mount` を持つ配布物の代役のモジュールの URL を作る */
function createMdmarkModuleUrl(): string {
  return URL.createObjectURL(
    new Blob(
      [
        `export const diffModes = ["blocks"];
export const mount = (element) => {
  for (let line = 0; line < ${MODULE_BLOCK_COUNT}; line += 1) {
    const block = document.createElement("div");
    block.dataset.sourceLine = String(line);
    block.style.height = "${BLOCK_HEIGHT}px";
    element.append(block);
  }
  return { update() {}, destroy() { element.replaceChildren(); } };
};`,
      ],
      { type: "text/javascript" },
    ),
  );
}

/** 元の行番号 `line` のブロックの先頭が画面の先頭に来る `scrollTop` */
function topOfLine(line: number): number {
  const block = document.querySelector(`[data-source-line="${line}"]`);
  return (block?.getBoundingClientRect().top ?? 0) + scroller().scrollTop;
}

/** `getState` が `state` を返し、`postMessage`・`setState` を記録する拡張機能の API の代役を置く */
function stubVsCodeApi(state: unknown) {
  const postMessage = vi.fn();
  const setState = vi.fn();
  const getState = vi.fn(() => state);
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage,
    setState,
    getState,
  }));
  return { postMessage, setState };
}

beforeEach(() => {
  // 拡張機能の API を持たないページで読み込んでも動くようにする
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage: vi.fn() }));
  document.body.style.margin = "0";
  trackListeners(window);
  trackListeners(document);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const { target, type, listener, options } of listeners.splice(0)) {
    target.removeEventListener(type, listener, options);
  }
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

// 帯を文書の前に 1 つだけ置き、configOk で消す（正常系）
test("test_show_config_error", async () => {
  // 準備
  const { mdmark, record } = createMdmark();
  const { view, root } = await createView(mdmark);
  view.render(renderMessage("# 本文"));
  const documentElement = record.elements[0] as HTMLElement;
  // 実行
  view.showConfigError(4);
  view.showConfigError(5);
  const bands = root.querySelectorAll<HTMLElement>(".mdmark-config-band");
  const afterTwoCalls = {
    count: bands.length,
    text: bands[0]?.textContent ?? "",
    before:
      ((bands[0]?.compareDocumentPosition(documentElement) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0,
  };
  view.clearConfigError();
  // 検証
  expect(afterTwoCalls.count).toBe(1);
  expect(afterTwoCalls.text).toContain("5 行目");
  expect(afterTwoCalls.before).toBe(true);
  expect(root.querySelectorAll(".mdmark-config-band")).toHaveLength(0);
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

// 保存した行を持つ view は、最初の render の後だけその行へ戻し、自分が起こしたスクロールとして捨てる（正常系）
test("test_render_when_saved_line", async () => {
  // 準備
  const { mdmark } = createMdmark();
  const { view } = await createView(mdmark, createRoot(), { savedLine: 20 });
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

// 404 は指定したバージョンが無い（正常系）
test("test_classify_load_failure", async () => {
  // 準備
  const { classifyLoadFailure } = await loadPreview();
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(null, { status: 404 }),
  );
  // 実行
  const reason = await classifyLoadFailure({
    url: "https://cdn.jsdelivr.net/gh/x/mdmark@v9.9.9/dist/index.js",
    fetch: fetchMock as unknown as typeof fetch,
  });
  // 検証
  expect(reason).toBe("versionMissing");
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
});

// ネットワークのエラーと 404 以外はオフライン（正常系）
test("test_classify_load_failure_when_network_error", async () => {
  // 準備
  const { classifyLoadFailure } = await loadPreview();
  const networkError = vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  const unavailable = vi.fn(async () => new Response(null, { status: 503 }));
  const url = "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.js";
  // 実行
  const reasons = [
    await classifyLoadFailure({
      url,
      fetch: networkError as unknown as typeof fetch,
    }),
    await classifyLoadFailure({
      url,
      fetch: unavailable as unknown as typeof fetch,
    }),
  ];
  // 検証
  expect(reasons).toEqual(["offline", "offline"]);
});

// 本物のクリックでもリンクの押下を `window` へ伝えず、`openLink` を 1 回だけ送る（正常系）
test("test_start_preview_when_link_clicked", async () => {
  // 準備: 入口を先に読み込んでから、描く先を包む要素を置いて始める
  const { startPreview } = await loadPreview();
  const postMessage = vi.fn();
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
  createRoot();
  const holder = document.createElement("div");
  holder.innerHTML =
    '<a href="https://example.com/">外部</a><a href="./other.md">別の文書</a><a href="#末尾">末尾へ</a><h2 id="末尾">末尾</h2>';
  document.body.append(holder);
  placed.push(holder);
  startPreview();
  // VS Code の Webview の外枠が `window` の `click` でリンクを開くため、`window` に届いた押下を記録する
  const reachedWindow = vi.fn();
  window.addEventListener("click", reachedWindow);
  try {
    // 実行: 本物のクリック（`isTrusted` が true）で押す
    for (const link of holder.querySelectorAll("a")) {
      await userEvent.click(link);
    }
  } finally {
    window.removeEventListener("click", reachedWindow);
  }
  // 検証
  expect(reachedWindow).not.toHaveBeenCalled();
  const opened = postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === "openLink");
  expect(opened).toEqual([
    { type: "openLink", href: "https://example.com/" },
    { type: "openLink", href: "./other.md" },
  ]);
});

// 右側の目次の項目の押下を右側の目次へ届け、window へは伝えない（正常系）
test("test_start_preview_when_side_toc_link_clicked", async () => {
  // 準備
  const { startPreview } = await loadPreview();
  const postMessage = vi.fn();
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
  createRoot();
  const holder = document.createElement("div");
  holder.innerHTML =
    '<aside class="mdmark-side-toc"><a href="#注意" data-heading-id="注意">注意</a></aside><h3 id="注意">注意</h3>';
  document.body.append(holder);
  placed.push(holder);
  startPreview();
  const aside = holder.querySelector("aside") as HTMLElement;
  const reachedAside = vi.fn();
  const reachedWindow = vi.fn();
  aside.addEventListener("click", reachedAside);
  window.addEventListener("click", reachedWindow);
  try {
    // 実行
    await userEvent.click(holder.querySelector("a") as HTMLElement);
  } finally {
    window.removeEventListener("click", reachedWindow);
  }
  // 検証
  expect(reachedAside).toHaveBeenCalledTimes(1);
  expect(reachedWindow).not.toHaveBeenCalled();
  const opened = postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === "openLink");
  expect(opened).toEqual([]);
});

// 差分に対応しない配布物で previous つきの render を受けると、描かずに理由を出す（異常系）
test("test_start_preview_when_diff_unsupported", async () => {
  // 準備: diffModes を持たず、mount の呼び出しだけを控える配布物の代役
  const { startPreview } = await loadPreview();
  const postMessage = vi.fn();
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
  const mountCalls: unknown[][] = [];
  vi.stubGlobal("__mdmarkDiffTestMounts", mountCalls);
  const moduleUrl = URL.createObjectURL(
    new Blob(
      [
        "export const mount = (...args) => { globalThis.__mdmarkDiffTestMounts.push(args); return { update() {}, destroy() {} }; };",
      ],
      { type: "text/javascript" },
    ),
  );
  try {
    const root = createRoot();
    root.dataset.distJs = moduleUrl;
    root.dataset.version = "v0.8.0";
    startPreview();
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    });
    // 実行
    window.dispatchEvent(
      new MessageEvent("message", {
        data: renderMessage("A2", { previous: "A1" }),
      }),
    );
    // 検証
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: "loadFailed",
        reason: "diffUnsupported",
      });
    });
    expect(mountCalls).toEqual([]);
    expect(postMessage).not.toHaveBeenCalledWith({ type: "rendered" });
    expect(root.textContent).toContain("v0.8.0");
    expect(root.querySelector('button[data-action="reload"]')).not.toBeNull();
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
});

// 保存した行の途中の位置を持つ状態で始めると、最初の render の後にその位置へ戻してから保存し、revealLine を送らない（正常系）
test("test_start_preview_when_state_saved", async () => {
  // 準備
  const { startPreview } = await loadPreview();
  const { postMessage, setState } = stubVsCodeApi({ line: 20.5 });
  const moduleUrl = createMdmarkModuleUrl();
  try {
    const root = createRoot();
    root.dataset.distJs = moduleUrl;
    startPreview();
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    });
    // 実行
    window.dispatchEvent(
      new MessageEvent("message", { data: renderMessage("# 本文") }),
    );
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "rendered" });
    });
    await nextFrames();
    // 検証
    const firstLine = setState.mock.calls[0]?.[0]?.line;
    expect(firstLine).toBeTypeOf("number");
    expect(Math.abs(firstLine - 20.5)).toBeLessThan(0.05);
    expect(setState).not.toHaveBeenCalledWith({ line: 0 });
    expect(setState).not.toHaveBeenCalledWith({ line: 20 });
    const revealed = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === "revealLine");
    expect(revealed).toEqual([]);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
});

// スクロールするたびに見えている先頭の行を保存し、描く前は保存しない（正常系）
test("test_start_preview_when_scrolled", async () => {
  // 準備
  const { startPreview } = await loadPreview();
  const { postMessage, setState } = stubVsCodeApi(undefined);
  const moduleUrl = createMdmarkModuleUrl();
  try {
    const root = createRoot();
    root.dataset.distJs = moduleUrl;
    startPreview();
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    });
    // 実行: 描く前のスクロールの知らせ
    window.dispatchEvent(new Event("scroll"));
    await nextFrames();
    const callsBeforeRender = setState.mock.calls.length;
    // 実行: 描いた後に元の行番号 30 のブロックを先頭へ動かす
    window.dispatchEvent(
      new MessageEvent("message", { data: renderMessage("# 本文") }),
    );
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "rendered" });
    });
    scroller().scrollTop = topOfLine(30);
    // 検証
    expect(callsBeforeRender).toBe(0);
    await vi.waitFor(() => {
      const lastLine = setState.mock.lastCall?.[0]?.line;
      expect(lastLine).toBeTypeOf("number");
      expect(Math.abs(lastLine - 30)).toBeLessThan(0.05);
    });
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
});

// 描いた後に相対パスを問い合わせ、返った URL に替える（正常系）
test("test_start_preview_when_assets", async () => {
  // 準備: `![操作](m/demo.mp4)` を動画にして描く配布物の代役
  const { startPreview } = await loadPreview();
  const { postMessage } = stubVsCodeApi(undefined);
  const moduleUrl = URL.createObjectURL(
    new Blob(
      [
        `export const diffModes = ["blocks"];
export const mount = (element) => {
  element.innerHTML = '<figure class="mdmark-figure mdmark-media"><video src="m/demo.mp4" controls aria-label="操作"></video></figure>';
  return { update() {}, destroy() { element.replaceChildren(); } };
};`,
      ],
      { type: "text/javascript" },
    ),
  );
  try {
    const root = createRoot();
    root.dataset.distJs = moduleUrl;
    startPreview();
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    });
    // 実行: 描く
    window.dispatchEvent(
      new MessageEvent("message", {
        data: renderMessage("![操作](m/demo.mp4)"),
      }),
    );
    // 検証: 相対パスを問い合わせる
    const request = await vi.waitFor(() => {
      const found = postMessage.mock.calls
        .map(([message]) => message)
        .find((message) => message.type === "resolveAssets");
      if (!found) {
        throw new Error("resolveAssets が送られていない");
      }
      return found;
    });
    expect(request.paths).toEqual(["m/demo.mp4"]);
    // 実行: 同じ id で URL を返す
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "assetsResolved",
          id: request.id,
          urls: { "m/demo.mp4": "https://w/demo.mp4" },
        },
      }),
    );
    // 検証
    await vi.waitFor(() => {
      expect(root.querySelector("video")?.getAttribute("src")).toBe(
        "https://w/demo.mp4",
      );
    });
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
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

// 呼ばれた時点の全文を返す（正常系）
test("test_create_diff_source", async () => {
  // 準備
  const { createDiffSource } = await loadPreview();
  const texts = { modified: "A2", original: "A1" };
  const source = createDiffSource(texts);
  // 実行
  texts.modified = "A3";
  const revisions = await source.revisions("diff");
  const modified = await source.content({
    docId: "diff",
    revisionId: "modified",
  });
  const original = await source.content({
    docId: "diff",
    revisionId: "original",
  });
  const otherRejected = await source
    .content({ docId: "diff", revisionId: "other" })
    .then(
      () => false,
      () => true,
    );
  // 検証
  expect(revisions.map((revision) => revision.id)).toEqual([
    "modified",
    "original",
  ]);
  expect(
    revisions.every((revision) => !Number.isNaN(Date.parse(revision.at))),
  ).toBe(true);
  expect(modified).toBe("A3");
  expect(original).toBe("A1");
  expect(otherRejected).toBe(true);
});

// diffModes に blocks があれば対応する（正常系）
test("test_supports_diff_blocks", async () => {
  // 準備
  const { supportsDiffBlocks } = await loadPreview();
  // 実行・検証
  expect(supportsDiffBlocks({ diffModes: ["button", "open", "blocks"] })).toBe(
    true,
  );
});

// diffModes が無いか blocks を含まなければ対応しない（正常系）
test("test_supports_diff_blocks_when_missing", async () => {
  // 準備
  const { supportsDiffBlocks } = await loadPreview();
  // 実行・検証
  expect(supportsDiffBlocks({})).toBe(false);
  expect(supportsDiffBlocks({ diffModes: ["button"] })).toBe(false);
  expect(supportsDiffBlocks({ diffModes: "blocks" })).toBe(false);
});
