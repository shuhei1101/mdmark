import { afterEach, expect, test } from "vitest";

/** 相対パスの画像・動画・音声の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAssets = () =>
  import(
    "../../../../../../../../vscode/src/webview/features/preview/panel/assets.ts"
  );

const roots: HTMLElement[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    root.remove();
  }
});

/** HTML を入れた描いた文書の要素をページに配置する */
function createRoot(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  roots.push(root);
  return root;
}

// 相対パスだけを重ねずに集める（正常系）
test("test_collect_asset_paths", async () => {
  // 準備
  const { collectAssetPaths } = await loadAssets();
  const root = createRoot(
    [
      '<img src="a.png" alt="">',
      '<img src="https://x/b.png" alt="">',
      '<video src="m/demo.mp4" poster="a.png"></video>',
      '<audio src="data:audio/mpeg;base64,AA=="></audio>',
    ].join(""),
  );
  // 実行
  const paths = collectAssetPaths(root);
  // 検証
  expect(paths).toEqual(["a.png", "m/demo.mp4"]);
});

// URL のあるパスだけを替える（正常系）
test("test_apply_asset_urls", async () => {
  // 準備
  const { applyAssetUrls } = await loadAssets();
  const root = createRoot(
    [
      '<video src="m/demo.mp4" poster="a.png"></video>',
      '<img src="none.png" alt="">',
    ].join(""),
  );
  // 実行
  applyAssetUrls(root, {
    "m/demo.mp4": "https://w/demo.mp4",
    "a.png": "https://w/a.png",
    "none.png": null,
  });
  // 検証
  const video = root.querySelector("video");
  expect(video?.getAttribute("src")).toBe("https://w/demo.mp4");
  expect(video?.getAttribute("poster")).toBe("https://w/a.png");
  expect(root.querySelector("img")?.getAttribute("src")).toBe("none.png");
});

// error の動画を枠に替え、記載したパスをリンクに持たせる（正常系）
test("test_attach_media_errors", async () => {
  // 準備
  const { attachMediaErrors } = await loadAssets();
  const root = createRoot(
    '<p>前</p><video data-mdmark-src="media/clip.webm"></video><p>後</p>',
  );
  const detach = attachMediaErrors(root);
  const video = root.querySelector("video");
  // 実行
  video?.dispatchEvent(new Event("error"));
  // 検証
  expect(root.querySelector("video")).toBeNull();
  const notice = root.querySelector(".mdmark-notice");
  expect(notice?.previousElementSibling?.textContent).toBe("前");
  expect(notice?.textContent).toContain("webm");
  expect(notice?.textContent).toContain("media/clip.webm");
  expect(
    notice
      ?.querySelector('a[data-action="openAsset"]')
      ?.getAttribute("data-path"),
  ).toBe("media/clip.webm");
  detach();
});

// 再生のボタンの動画と poster のパスも集める（正常系）
test("test_collect_asset_paths_when_media_open", async () => {
  // 準備
  const { collectAssetPaths } = await loadAssets();
  const root = createRoot(
    '<button class="mdmark-media-open" type="button" data-media-kind="video" data-media-src="m/demo.mp4" data-media-poster="m/p.png"></button>',
  );
  // 実行
  const paths = collectAssetPaths(root);
  // 検証
  expect(paths).toEqual(["m/demo.mp4", "m/p.png"]);
});

// 再生のボタンの data-media-src と data-media-poster を替える（正常系）
test("test_apply_asset_urls_when_media_open", async () => {
  // 準備
  const { applyAssetUrls } = await loadAssets();
  const root = createRoot(
    '<button class="mdmark-media-open" type="button" data-media-kind="video" data-media-src="m/demo.mp4" data-media-poster="m/p.png"></button>',
  );
  // 実行
  applyAssetUrls(root, {
    "m/demo.mp4": "https://w/demo.mp4",
    "m/p.png": "https://w/p.png",
  });
  // 検証
  const button = root.querySelector("button.mdmark-media-open");
  expect(button?.getAttribute("data-media-src")).toBe("https://w/demo.mp4");
  expect(button?.getAttribute("data-media-poster")).toBe("https://w/p.png");
});

// 再生のダイアログの中の再生できない動画を通知に替える（正常系）
test("test_attach_media_errors_when_modal", async () => {
  // 準備
  const { attachMediaErrors } = await loadAssets();
  const root = createRoot("<p>本文</p>");
  const detach = attachMediaErrors(root);
  const dialog = document.createElement("dialog");
  dialog.className = "mdmark-media-modal";
  dialog.innerHTML =
    '<div class="mdmark-media-modal-stage"><video data-mdmark-src="media/clip.webm"></video></div>';
  root.append(dialog);
  // 実行
  dialog.querySelector("video")?.dispatchEvent(new Event("error"));
  // 検証
  const stage = dialog.querySelector(".mdmark-media-modal-stage");
  expect(stage?.querySelector("video")).toBeNull();
  const notice = stage?.querySelector(".mdmark-notice");
  expect(notice?.textContent).toContain("webm");
  expect(notice?.textContent).toContain("media/clip.webm");
  detach();
});
