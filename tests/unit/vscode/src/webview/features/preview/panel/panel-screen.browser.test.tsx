import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { WebviewMessage } from "../../../../../../../../vscode/src/messages.ts";
import { createFakeVsCodeApi } from "../../../../../../../../vscode/src/webview/testing/fake-vscode-api.ts";
import { handlers } from "../../../../../../../../vscode/src/webview/testing/msw/handlers.ts";
import { test } from "../../../msw-test.ts";
import {
  createMdmark,
  createMdmarkModuleUrl,
  createRoot,
  nextFrames,
  renderMessage,
  scroller,
  sendHostMessage,
} from "../../../webview-helpers.ts";

/** プレビューの画面を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadScreen = () =>
  import(
    "../../../../../../../../vscode/src/webview/features/preview/panel/panel-screen.tsx"
  );
/** Webview のアプリを読み込む（Error Boundary へ渡すテストで使う） */
const loadApp = () =>
  import("../../../../../../../../vscode/src/webview/app/app.tsx");

/** 読み込み中を出すまでの待ち（設計書の `LOADING_DELAY_MS`） */
const LOADING_DELAY_MS = 1000;
/** 配布物の URL（MSW の HEAD のハンドラが当たる） */
const DIST_JS =
  "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.7.0/dist/index.js";

const placed: HTMLElement[] = [];

/** 描く先を包む要素と始め方を作る */
const createBoot = (
  overrides: Partial<{
    distJs: string | undefined;
    version: string | undefined;
    status: "versionUndecidable" | undefined;
    extensions: string[];
    test: boolean;
  }> = {},
) => {
  const root = createRoot(placed);
  return {
    root,
    distJs: DIST_JS,
    version: "v0.7.0",
    status: undefined,
    configPath: "mdmark.config.yaml",
    extensions: [] as string[],
    test: false,
    ...overrides,
  };
};

/** 送られたメッセージのうち `type` が一致するもの */
const postedOf = (posted: WebviewMessage[], type: WebviewMessage["type"]) =>
  posted.filter((message) => message.type === type);

/** `ready` が送られるまで待つ */
const waitReady = async (posted: WebviewMessage[]): Promise<void> => {
  await vi.waitFor(() => {
    expect(postedOf(posted, "ready")).toHaveLength(1);
  });
};

beforeEach(() => {
  document.body.style.margin = "0";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  scroller().scrollTop = 0;
  for (const element of placed.splice(0)) {
    element.remove();
  }
});

// 配布物を読み終えたら ready を送り、render で描いて rendered を送る（正常系）
test("test_panel_screen_when_rendered", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const { mdmark, record } = createMdmark();
  const boot = createBoot();
  render(
    <PanelScreen boot={boot} api={api} load={async () => mdmark as never} />,
    { container: boot.root },
  );
  await waitReady(api.posted);
  // 実行
  act(() => sendHostMessage(renderMessage("# 本文")));
  // 検証
  await vi.waitFor(() => {
    expect(postedOf(api.posted, "rendered")).toHaveLength(1);
  });
  const types = api.posted.map((message) => message.type);
  expect(types.indexOf("ready")).toBeLessThan(types.indexOf("rendered"));
  expect(
    record.elements[0]?.querySelector("[data-source-line]"),
  ).not.toBeNull();
  expect(boot.root.querySelector(".mdmark-preview-status")).toBeNull();
});

// 1 秒経っても描けていなければ読み込み中を出し、render で消す（正常系）
test("test_panel_screen_when_slow", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const api = createFakeVsCodeApi();
  const { mdmark } = createMdmark();
  let resolveLoad: (value: never) => void = () => undefined;
  const load = () =>
    new Promise<never>((resolve) => {
      resolveLoad = resolve;
    });
  const boot = createBoot();
  render(<PanelScreen boot={boot} api={api} load={load} />, {
    container: boot.root,
  });
  // 実行
  await act(async () => {
    vi.advanceTimersByTime(LOADING_DELAY_MS);
  });
  const loading = boot.root.querySelector("h1")?.textContent;
  await act(async () => {
    resolveLoad(mdmark as never);
  });
  vi.useRealTimers();
  await waitReady(api.posted);
  act(() => sendHostMessage(renderMessage("# 本文")));
  // 検証
  expect(loading).toBe("mdmark を読み込んでいます");
  await vi.waitFor(() => {
    expect(boot.root.querySelector(".mdmark-preview-status")).toBeNull();
  });
});

// 配布物を読めなければ理由とバージョンを出し、loadFailed を送る（異常系）
test("test_panel_screen_when_load_failed", async ({ worker }) => {
  // 準備
  worker.use(...handlers("offline"));
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const boot = createBoot();
  // 実行
  render(
    <PanelScreen
      boot={boot}
      api={api}
      load={() => Promise.reject(new TypeError("Failed to fetch"))}
    />,
    { container: boot.root },
  );
  // 検証
  await vi.waitFor(() => {
    expect(postedOf(api.posted, "loadFailed")).toEqual([
      { type: "loadFailed", reason: "offline" },
    ]);
  });
  const status = screen.getByRole("status");
  expect(status.textContent).toContain("v0.7.0");
  expect(status.querySelector('button[data-action="reload"]')).not.toBeNull();
  expect(boot.root.textContent).not.toContain("mdmark を読み込んでいます");
});

// バージョンを決められないときは配布物を読まずに理由を出す（正常系）
test("test_panel_screen_when_version_undecidable", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const load = vi.fn();
  const boot = createBoot({
    distJs: undefined,
    version: undefined,
    status: "versionUndecidable",
  });
  // 実行
  render(<PanelScreen boot={boot} api={api} load={load} />, {
    container: boot.root,
  });
  await nextFrames();
  // 検証
  expect(load).not.toHaveBeenCalled();
  expect(postedOf(api.posted, "ready")).toEqual([]);
  expect(screen.getByRole("status").textContent).toContain(
    "読む mdmark のバージョンを決められませんでした。",
  );
});

// 差分に対応しない配布物で previous つきの render を受けると、描かずに理由を出す（異常系）
test("test_panel_screen_when_diff_unsupported", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const { mdmark, record } = createMdmark({ diffModes: undefined });
  const boot = createBoot({ version: "v0.8.0" });
  render(
    <PanelScreen boot={boot} api={api} load={async () => mdmark as never} />,
    { container: boot.root },
  );
  await waitReady(api.posted);
  // 実行
  act(() => sendHostMessage(renderMessage("A2", { previous: "A1" })));
  // 検証
  await vi.waitFor(() => {
    expect(postedOf(api.posted, "loadFailed")).toEqual([
      { type: "loadFailed", reason: "diffUnsupported" },
    ]);
  });
  expect(record.mount).not.toHaveBeenCalled();
  expect(postedOf(api.posted, "rendered")).toEqual([]);
  const status = screen.getByRole("status");
  expect(status.textContent).toContain("v0.8.0");
  expect(status.querySelector('button[data-action="reload"]')).not.toBeNull();
});

// リロードで reload を送る（正常系）
test("test_panel_screen_when_reload_clicked", async ({ worker }) => {
  // 準備
  worker.use(...handlers("offline"));
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const boot = createBoot();
  render(
    <PanelScreen
      boot={boot}
      api={api}
      load={() => Promise.reject(new TypeError("Failed to fetch"))}
    />,
    { container: boot.root },
  );
  const button = await screen.findByRole("button", { name: "リロード" });
  // 実行
  await userEvent.click(button);
  // 検証
  expect(postedOf(api.posted, "reload")).toEqual([{ type: "reload" }]);
});

// configError で帯を文書の前に 1 つだけ出し、configOk で消す（正常系）
test("test_panel_screen_when_config_error", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const { mdmark, record } = createMdmark();
  const boot = createBoot();
  render(
    <PanelScreen boot={boot} api={api} load={async () => mdmark as never} />,
    { container: boot.root },
  );
  await waitReady(api.posted);
  act(() => sendHostMessage(renderMessage("# 本文")));
  await vi.waitFor(() => {
    expect(postedOf(api.posted, "rendered")).toHaveLength(1);
  });
  // 実行
  act(() =>
    sendHostMessage({
      type: "configError",
      path: "mdmark.config.yaml",
      line: 4,
    }),
  );
  const afterOne =
    boot.root.querySelector(".mdmark-config-band")?.textContent ?? "";
  act(() =>
    sendHostMessage({
      type: "configError",
      path: "~/.config/mdmark/settings.yaml",
      settingKey: "features.callout",
    }),
  );
  const bands = boot.root.querySelectorAll(".mdmark-config-band");
  const documentElement = record.elements[0] as HTMLElement;
  const afterTwo = {
    count: bands.length,
    text: bands[0]?.textContent ?? "",
    before:
      ((bands[0]?.compareDocumentPosition(documentElement) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0,
  };
  await userEvent.click(
    screen.getByRole("button", { name: "設定ファイルを開く" }),
  );
  act(() => sendHostMessage({ type: "configOk" }));
  // 検証
  expect(afterOne).toContain("mdmark.config.yaml");
  expect(afterOne).toContain("4 行目");
  expect(afterTwo.count).toBe(1);
  expect(afterTwo.text).toContain("~/.config/mdmark/settings.yaml");
  expect(afterTwo.text).toContain("features.callout");
  expect(afterTwo.before).toBe(true);
  expect(postedOf(api.posted, "openConfig")).toEqual([{ type: "openConfig" }]);
  expect(boot.root.querySelectorAll(".mdmark-config-band")).toHaveLength(0);
});

// 配布物を読んだ後、extensions を登録してから ready を送る（正常系）
test("test_panel_screen_when_extensions", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const { mdmark } = createMdmark();
  const order: string[] = [];
  const registerExtension = vi.fn((extension: unknown) => {
    order.push(`register:${(extension as { name: string }).name}`);
  });
  const originalPost = api.postMessage.bind(api);
  vi.spyOn(api, "postMessage").mockImplementation((message) => {
    order.push(`post:${message.type}`);
    originalPost(message);
  });
  const importModule = vi.fn(async (url: string) => {
    if (url === "a.js") {
      throw new Error("読めない");
    }
    return { default: { name: url } };
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const boot = createBoot({ extensions: ["a.js", "b.js"] });
  // 実行
  render(
    <PanelScreen
      boot={boot}
      api={api}
      load={async () => ({ ...mdmark, registerExtension }) as never}
      importModule={importModule}
    />,
    { container: boot.root },
  );
  await waitReady(api.posted);
  // 検証
  expect(registerExtension.mock.calls).toEqual([[{ name: "b.js" }]]);
  expect(order.indexOf("register:b.js")).toBeLessThan(
    order.indexOf("post:ready"),
  );
});

// theme で theme の CSS の link の href を替える（正常系）
test("test_panel_screen_when_theme", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const { mdmark, record } = createMdmark();
  const link = document.createElement("link");
  link.id = "mdmark-theme";
  link.rel = "stylesheet";
  link.href = "t.css";
  document.head.append(link);
  const boot = createBoot();
  render(
    <PanelScreen boot={boot} api={api} load={async () => mdmark as never} />,
    { container: boot.root },
  );
  await waitReady(api.posted);
  act(() => sendHostMessage(renderMessage("# 本文")));
  await vi.waitFor(() => {
    expect(postedOf(api.posted, "rendered")).toHaveLength(1);
  });
  const rendered = record.elements.length;
  // 実行
  act(() => sendHostMessage({ type: "theme", href: "t.css?v=1" }));
  // 検証
  expect(link.getAttribute("href")).toBe("t.css?v=1");
  expect(record.elements.length).toBe(rendered);
  expect(postedOf(api.posted, "rendered")).toHaveLength(1);
  link.remove();
});

// 保存した行の途中の位置を持つ状態で始めると、最初の render の後にその位置へ戻してから保存し、revealLine を送らない（正常系）
test("test_panel_screen_when_state_saved", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const { mdmark } = createMdmark();
  const boot = createBoot();
  render(
    <PanelScreen
      boot={boot}
      api={api}
      savedLine={20.5}
      load={async () => mdmark as never}
    />,
    { container: boot.root },
  );
  await waitReady(api.posted);
  // 実行
  act(() => sendHostMessage(renderMessage("# 本文")));
  await vi.waitFor(() => {
    expect(postedOf(api.posted, "rendered")).toHaveLength(1);
  });
  await nextFrames();
  // 検証
  const firstLine = api.states[0]?.line;
  expect(firstLine).toBeTypeOf("number");
  expect(Math.abs((firstLine ?? 0) - 20.5)).toBeLessThan(0.05);
  expect(api.states).not.toContainEqual({ line: 0 });
  expect(api.states).not.toContainEqual({ line: 20 });
  expect(postedOf(api.posted, "revealLine")).toEqual([]);
});

// 描いた後に相対パスを問い合わせ、返った URL に替える（正常系）
test("test_panel_screen_when_assets", async () => {
  // 準備: `![操作](m/demo.mp4)` を動画にして描く配布物の代役
  const { PanelScreen } = await loadScreen();
  const api = createFakeVsCodeApi();
  const mdmark = {
    diffModes: ["blocks"],
    mount: (element: HTMLElement) => {
      element.innerHTML =
        '<figure class="mdmark-figure mdmark-media"><video src="m/demo.mp4" controls aria-label="操作"></video></figure>';
      return {
        update: () => undefined,
        destroy: () => element.replaceChildren(),
      };
    },
  };
  const boot = createBoot();
  render(
    <PanelScreen boot={boot} api={api} load={async () => mdmark as never} />,
    { container: boot.root },
  );
  await waitReady(api.posted);
  // 実行: 描く
  act(() => sendHostMessage(renderMessage("![操作](m/demo.mp4)")));
  // 検証: 相対パスを問い合わせる
  const request = await vi.waitFor(() => {
    const [found] = postedOf(api.posted, "resolveAssets");
    if (found?.type !== "resolveAssets") {
      throw new Error("resolveAssets が送られていない");
    }
    return found;
  });
  expect(request.paths).toEqual(["m/demo.mp4"]);
  // 実行: 同じ id で URL を返す
  act(() =>
    sendHostMessage({
      type: "assetsResolved",
      id: request.id,
      urls: { "m/demo.mp4": "https://w/demo.mp4" },
    }),
  );
  // 検証
  await vi.waitFor(() => {
    expect(boot.root.querySelector("video")?.getAttribute("src")).toBe(
      "https://w/demo.mp4",
    );
  });
});

// テストのときだけ inspect と axe に答える（正常系）
test("test_panel_screen_when_inspect", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const { mdmark } = createMdmark();
  const results: Record<string, WebviewMessage[]> = {};
  for (const testMode of [true, false]) {
    const api = createFakeVsCodeApi();
    const boot = createBoot({ test: testMode });
    const { unmount } = render(
      <PanelScreen boot={boot} api={api} load={async () => mdmark as never} />,
      { container: boot.root },
    );
    await waitReady(api.posted);
    // 実行
    act(() =>
      sendHostMessage({ type: "inspect", id: 7, selector: "#mdmark-preview" }),
    );
    await nextFrames();
    await new Promise((resolve) => setTimeout(resolve, 50));
    results[String(testMode)] = postedOf(api.posted, "inspected");
    unmount();
  }
  // 検証
  expect(results.true).toHaveLength(1);
  expect(results.true?.[0]).toMatchObject({ type: "inspected", id: 7 });
  expect(results.false).toEqual([]);
});

// テストのときだけ CSP の違反の件数を html 要素に書く（正常系）
test("test_panel_screen_when_csp_violation", async () => {
  // 準備
  const { PanelScreen } = await loadScreen();
  const { mdmark } = createMdmark();
  const results: Record<string, (string | undefined)[]> = {};
  for (const testMode of [true, false]) {
    const api = createFakeVsCodeApi();
    const boot = createBoot({ test: testMode });
    const { unmount } = render(
      <PanelScreen boot={boot} api={api} load={async () => mdmark as never} />,
      { container: boot.root },
    );
    await waitReady(api.posted);
    const drawn = document.documentElement.dataset.mdmarkCspViolations;
    // 実行
    for (let count = 0; count < 2; count += 1) {
      document.dispatchEvent(new Event("securitypolicyviolation"));
    }
    results[String(testMode)] = [
      drawn,
      document.documentElement.dataset.mdmarkCspViolations,
    ];
    unmount();
    delete document.documentElement.dataset.mdmarkCspViolations;
  }
  // 検証
  expect(results.true).toEqual(["0", "2"]);
  expect(results.false).toEqual([undefined, undefined]);
});

// 拡張機能のメッセージでない message を処理しない（正常系）
test("test_panel_screen_when_unknown_message", async () => {
  // 準備
  const { App } = await loadApp();
  const api = createFakeVsCodeApi();
  const boot = createBoot();
  // App は `load` を受けないため、画面が読む配布物の URL を代役のモジュールにする
  const moduleUrl = createMdmarkModuleUrl();
  try {
    render(<App boot={{ ...boot, distJs: moduleUrl }} api={api} />, {
      container: boot.root,
    });
    await waitReady(api.posted);
    // 実行
    act(() => {
      sendHostMessage({ type: "msw/worker:stop" });
      sendHostMessage({ line: 3 });
      sendHostMessage(renderMessage("# 本文"));
    });
    // 検証
    await vi.waitFor(() => {
      expect(postedOf(api.posted, "rendered")).toHaveLength(1);
    });
    expect(boot.root.querySelector(".mdmark-preview-status")).toBeNull();
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
});

// メッセージの処理で投げた例外を Error Boundary へ渡す（異常系）
test("test_panel_screen_when_handler_throws", async () => {
  // 準備
  const { App } = await loadApp();
  const api = createFakeVsCodeApi();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const boot = createBoot();
  // App は `load` を受けないため、画面が読む配布物の URL を代役のモジュールにする
  const moduleUrl = URL.createObjectURL(
    new Blob(
      [
        'export const diffModes = ["blocks"]; export const mount = () => { throw new Error("mount の失敗"); };',
      ],
      { type: "text/javascript" },
    ),
  );
  try {
    render(<App boot={{ ...boot, distJs: moduleUrl }} api={api} />, {
      container: boot.root,
    });
    await waitReady(api.posted);
    // 実行
    act(() => sendHostMessage(renderMessage("# 本文")));
    // 検証
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain(
      "プレビューの表示中にエラーが発生しました。",
    );
    expect(status.querySelector('button[data-action="reload"]')).not.toBeNull();
    expect(postedOf(api.posted, "rendered")).toEqual([]);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
});
