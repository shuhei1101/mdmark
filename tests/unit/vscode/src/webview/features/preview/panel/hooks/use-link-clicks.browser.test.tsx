import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createFakeVsCodeApi } from "../../../../../../../../../vscode/src/webview/testing/fake-vscode-api.ts";

/** リンクの押下の hook を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHook = () =>
  import(
    "../../../../../../../../../vscode/src/webview/features/preview/panel/hooks/use-link-clicks.ts"
  );

const placed: HTMLElement[] = [];

/** HTML を入れた要素をページに配置する */
const place = (html: string): HTMLElement => {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  document.body.append(holder);
  placed.push(holder);
  return holder;
};

afterEach(() => {
  cleanup();
  for (const element of placed.splice(0)) {
    element.remove();
  }
});

// 本物のクリックでもリンクの押下を window へ伝えず、openLink を 1 回だけ送信する（正常系）
test("test_use_link_clicks", async () => {
  // 準備
  const { useLinkClicks } = await loadHook();
  const api = createFakeVsCodeApi();
  const holder = place(
    '<a href="https://example.com/">外部</a><a href="./other.md">別の文書</a><a href="#末尾">末尾へ</a><h2 id="末尾">末尾</h2>',
  );
  renderHook(() => useLinkClicks(api));
  // VS Code の Webview の外枠が window の click でリンクを開くため、window に届いた押下を記録する
  const reachedWindow = vi.fn();
  window.addEventListener("click", reachedWindow);
  try {
    // 実行: 本物のクリック（isTrusted が true）で押す
    for (const link of holder.querySelectorAll("a")) {
      await userEvent.click(link);
    }
  } finally {
    window.removeEventListener("click", reachedWindow);
  }
  // 検証
  expect(reachedWindow).not.toHaveBeenCalled();
  expect(api.posted.filter((message) => message.type === "openLink")).toEqual([
    { type: "openLink", href: "https://example.com/" },
    { type: "openLink", href: "./other.md" },
  ]);
});

// 右側の目次の項目の押下を右側の目次へ届け、window へは伝えない（正常系）
test("test_use_link_clicks_when_side_toc", async () => {
  // 準備
  const { useLinkClicks } = await loadHook();
  const api = createFakeVsCodeApi();
  const holder = place(
    '<aside class="mdmark-side-toc"><a href="#注意" data-heading-id="注意">注意</a></aside><h3 id="注意">注意</h3>',
  );
  renderHook(() => useLinkClicks(api));
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
  expect(api.posted.filter((message) => message.type === "openLink")).toEqual(
    [],
  );
});

// 既定のアプリで開くは記載したパスで openAsset を送信する（正常系）
test("test_use_link_clicks_when_open_asset", async () => {
  // 準備
  const { useLinkClicks } = await loadHook();
  const api = createFakeVsCodeApi();
  const holder = place(
    '<a href="#" data-action="openAsset" data-path="media/a.webm">既定のアプリで開く</a>',
  );
  renderHook(() => useLinkClicks(api));
  // 実行
  await userEvent.click(holder.querySelector("a") as HTMLElement);
  // 検証
  expect(api.posted).toEqual([{ type: "openAsset", path: "media/a.webm" }]);
});
