import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

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

const placed: HTMLElement[] = [];

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

/** パネルの表示を作る */
async function createView(mdmark: unknown, root = createRoot()) {
  const { PreviewView } = await loadPreview();
  const view = new PreviewView({
    root,
    mdmark: mdmark as ConstructorParameters<typeof PreviewView>[0]["mdmark"],
  });
  return { view, root };
}

/** `render` のメッセージを作る */
function renderMessage(
  markdown: string,
  options: {
    config?: Record<string, unknown>;
    theme?: "auto" | "light" | "dark";
  } = {},
) {
  return {
    type: "render" as const,
    markdown,
    config: options.config ?? {},
    theme: options.theme ?? "auto",
  };
}

/** 画面がスクロールする要素 */
function scroller(): Element {
  return document.scrollingElement ?? document.documentElement;
}

beforeEach(() => {
  // 拡張機能の API を持たないページで読み込んでも動くようにする
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage: vi.fn() }));
  document.body.style.margin = "0";
});

afterEach(() => {
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
  const [heading, image] = view.inspect("h1, img");
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
