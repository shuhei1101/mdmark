import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Frame, test } from "@playwright/test";
import { readMediaSamples } from "../media.ts";
import { useVscodeE2E, type VscodeSession } from "../vscode.ts";

const e2e = useVscodeE2E();

/** 1 x 1 の PNG */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** 外部の URL。拡張機能のテストの VS Code は、信頼していないドメインを開くときの確認のダイアログを出せないため、VS Code が既定で信頼しているドメインにする */
const EXTERNAL_URL = "https://aka.ms/mdmark";

/** リンクと画像を持つ Markdown: 外部の URL・同じフォルダの `other.md`・同じ文書の見出しへの `#` のリンクと、画面の外にある見出し */
const LINK_GUIDE = [
  "# 案内",
  "",
  `[外部](${EXTERNAL_URL})`,
  "",
  "[別の文書](./other.md)",
  "",
  "[ページ内](#末尾)",
  "",
  "![図](./images/figure.png)",
  "",
  ...Array.from({ length: 150 }, (_, index) => [
    `段落 ${index + 1}`,
    "",
  ]).flat(),
  "## 末尾",
  "",
  ...Array.from({ length: 80 }, (_, index) => [
    `後の段落 ${index + 1}`,
    "",
  ]).flat(),
].join("\n");

/** ワークスペースの外を指す画像を持つ Markdown（`docs/` からの `../../` はワークスペースの 1 つ上のフォルダ） */
const OUTSIDE_GUIDE = [
  "# 外の画像",
  "",
  "![外の画像](../../outside.png)",
  "",
].join("\n");

/** リンクを持つ文書のプレビューを開く */
async function openLinkGuide(session: VscodeSession): Promise<Frame> {
  await session.openFile("docs/guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h1");
  await expect(frame.locator("img")).toHaveCount(1);
  return frame;
}

/** 見本のワークスペースのファイル */
function files(): Record<string, string | Buffer> {
  return {
    "docs/guide.md": LINK_GUIDE,
    "docs/other.md": "# 別の文書\n",
    "docs/images/figure.png": PNG,
    "docs/outside.md": OUTSIDE_GUIDE,
    "../outside.png": PNG,
  };
}

// 外部の URL のリンクを押すと、既定のブラウザで 1 回だけ開き、プレビューは変わらない（正常シナリオ（外部の URL））
test("test_normal_when_external_link", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  const frame = await openLinkGuide(session);
  const scrollTop = await frame.evaluate(() => window.scrollY);
  // 実行
  await frame.locator(`a[href="${EXTERNAL_URL}"]`).click();
  // 検証
  await expect.poll(() => session.openedUrls()).toEqual([EXTERNAL_URL]);
  await session.win.waitForTimeout(1000);
  expect(await session.openedUrls()).toEqual([EXTERNAL_URL]);
  expect(await frame.evaluate(() => window.scrollY)).toBe(scrollTop);
  await expect(frame.locator("h1")).toContainText("案内");
});

// Markdown へのリンクを押すと、VS Code のエディタで開き、ブラウザでは開かない（正常シナリオ（Markdown へのリンク））
test("test_normal_when_markdown_link", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  const frame = await openLinkGuide(session);
  // 実行
  await frame.locator('a[href="./other.md"]').click();
  // 検証
  await expect(
    session.win.getByRole("tab", { name: /^other\.md/ }),
  ).toHaveCount(1);
  await session.win.waitForTimeout(1000);
  expect(await session.openedUrls()).toEqual([]);
});

// ページの中へのリンクを押すと、プレビューの中で見出しへ移り、エディタを開き直さず、ブラウザでも開かない（正常シナリオ（ページの中へのリンク））
test("test_normal_when_anchor_link", async () => {
  // 準備
  const session = await e2e.launch({
    files: files(),
    settings: {
      "mdmark.preview.scrollPreviewWithEditor": false,
      "mdmark.preview.scrollEditorWithPreview": false,
    },
  });
  const frame = await openLinkGuide(session);
  const viewport = await frame.evaluate(() => window.innerHeight);
  const heading = frame.locator("h2", { hasText: "末尾" });
  expect(
    await heading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeGreaterThan(viewport);
  const tabs = await session.win.locator(".tab").count();
  // 実行
  await frame.getByRole("link", { name: "ページ内" }).click();
  // 検証
  await expect
    .poll(() =>
      heading.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThan(viewport);
  expect(
    await heading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeGreaterThanOrEqual(-2);
  expect(await session.win.locator(".tab").count()).toBe(tabs);
  expect(await session.openedUrls()).toEqual([]);
});

// Markdown からの相対パスの画像が、プレビューに読み込まれる（正常シナリオ（相対パスの画像））
test("test_normal_when_relative_image", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  // 実行
  const frame = await openLinkGuide(session);
  // 検証
  const image = frame.locator('img[alt="図"]');
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => [
        element.naturalWidth,
        element.naturalHeight,
      ]),
    )
    .toEqual([1, 1]);
});

// ワークスペースの外の画像は読み込まず、代わりの文字を出し、他の本文は描く（異常シナリオ（ワークスペースの外の画像））
test("test_error_when_image_outside_workspace", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  await session.openFile("docs/outside.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.frameWith("img");
  const image = frame.locator('img[alt="外の画像"]');
  await expect(image).toHaveCount(1);
  await session.win.waitForTimeout(1000);
  expect(
    await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
  ).toBe(0);
  await expect(frame.locator("h1")).toContainText("外の画像");
});

/** Webview から読めるローカルのファイルの URL の頭（デコードした後） */
const WEBVIEW_RESOURCE =
  /^https:\/\/file\+\.vscode-resource\.vscode-cdn\.net\//;

/** 音声の再生バーの左端から再生ボタンの中までの距離（px） */
const PLAY_BUTTON_X = 20;

/** 動画の左下の角から再生バーの再生ボタンの中までの距離（px） */
const VIDEO_PLAY_BUTTON_INSET = 28;

/** 動画と音声のプレビューを開き、音声と動画の要素が描かれたフレームを返す */
async function openMediaGuide(session: VscodeSession): Promise<Frame> {
  await session.openFile("docs/guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("video");
  await expect(frame.locator("audio")).toHaveCount(1);
  return frame;
}

/** 音声と動画の再生ボタンを押し、両方の再生位置が進むことを確かめる */
async function expectPlayed(frame: Frame): Promise<void> {
  const audio = frame.locator("audio");
  const video = frame.locator("video");
  for (const element of [audio, video]) {
    await expect
      .poll(() =>
        element.evaluate((media: HTMLMediaElement) => media.readyState),
      )
      .toBeGreaterThanOrEqual(1);
  }
  // 音声の再生バーの再生ボタンは左端の中央。動画は、ポインターを乗せると出る再生バーの左端
  const audioBox = await audio.boundingBox();
  await audio.click({
    position: { x: PLAY_BUTTON_X, y: (audioBox?.height ?? 0) / 2 },
  });
  await video.hover();
  const videoBox = await video.boundingBox();
  await video.click({
    position: {
      x: VIDEO_PLAY_BUTTON_INSET,
      y: (videoBox?.height ?? 0) - VIDEO_PLAY_BUTTON_INSET,
    },
  });
  for (const [name, element] of [
    ["音声", audio],
    ["動画", video],
  ] as const) {
    await expect
      .poll(
        () => element.evaluate((media: HTMLMediaElement) => media.currentTime),
        { message: `${name}の再生位置が進まない` },
      )
      .toBeGreaterThan(0);
  }
}

/** 見本の音声（mp3）と動画（mp4） */
async function mediaFiles(): Promise<{ mp3: Buffer; mp4: Buffer }> {
  const { mp3, mp4 } = await readMediaSamples();
  return { mp3, mp4 };
}

// Markdown からの相対パスの音声と動画を Webview から読める URL にし、再生ボタンで再生位置が進む（正常シナリオ（相対パスの動画・音声））
test("test_normal_when_relative_media", async () => {
  // 準備
  const { mp3, mp4 } = await mediaFiles();
  const session = await e2e.launch({
    files: {
      "docs/guide.md":
        "# 動画と音声\n\n![音声](media/demo.mp3)\n\n![動画](media/demo.mp4)\n",
      "docs/media/demo.mp3": mp3,
      "docs/media/demo.mp4": mp4,
    },
  });
  // 実行
  const frame = await openMediaGuide(session);
  // 検証: src が Webview から読める URL
  for (const [selector, path] of [
    ["audio", "/docs/media/demo.mp3"],
    ["video", "/docs/media/demo.mp4"],
  ] as const) {
    await expect
      .poll(async () =>
        decodeURIComponent(
          (await frame.locator(selector).getAttribute("src")) ?? "",
        ),
      )
      .toMatch(new RegExp(`${WEBVIEW_RESOURCE.source}.*${path}$`));
  }
  // 実行・検証: 再生ボタンを押すと再生位置が進む
  await expectPlayed(frame);
});

// 再生できない音声と動画の場所に知らせの枠と「既定のアプリで開く」のリンクを出し、押すと既定のアプリで開く（異常シナリオ（プレビューで再生できない形式））
test("test_error_when_unsupported_media", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "docs/guide.md":
        "# 再生できない形式\n\n![声](media/voice.m4a)\n\n![動き](media/clip.webm)\n\n本文の段落。\n",
      "docs/media/voice.m4a": Buffer.from("m4a"),
      "docs/media/clip.webm": Buffer.from("webm"),
    },
  });
  await session.openFile("docs/guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証: 音声と動画の場所に知らせの枠と既定のアプリで開くリンク
  const frame = await session.frameWith(".mdmark-notice");
  const notices = frame.locator(".mdmark-notice");
  await expect(notices).toHaveCount(2);
  await expect(notices.nth(0)).toContainText(
    "この音声をプレビューで再生できません",
  );
  await expect(notices.nth(1)).toContainText(
    "この動画をプレビューで再生できません",
  );
  const links = frame.locator('a[data-action="openAsset"]');
  await expect(links).toHaveText(["既定のアプリで開く", "既定のアプリで開く"]);
  await expect(frame.locator("p", { hasText: "本文の段落。" })).toHaveCount(1);
  // 実行: 音声のリンクを押す
  await links.nth(0).click();
  // 検証: 拡張機能がそのファイルを既定のアプリで開く
  await expect
    .poll(() => session.openedUrls())
    .toEqual([
      pathToFileURL(join(session.workspaceDir, "docs/media/voice.m4a")).href,
    ]);
});

// 文書からの相対パスに無い音声と動画を、設定のアセットのルートで探して Webview から読める URL にし、再生ボタンで再生位置が進む（正常シナリオ（アセットのルートの動画・音声））
test("test_normal_when_media_in_asset_root", async () => {
  // 準備
  const { mp3, mp4 } = await mediaFiles();
  const session = await e2e.launch({
    files: {
      "mdmark.config.yaml": "assets:\n  root: assets\n",
      "docs/guide.md":
        "# 動画と音声\n\n![音声](media/intro.mp3)\n\n![動画](media/intro.mp4)\n",
      "assets/media/intro.mp3": mp3,
      "assets/media/intro.mp4": mp4,
    },
  });
  // 実行
  const frame = await openMediaGuide(session);
  // 検証: src がアセットのルートのファイルの Webview から読める URL
  for (const [selector, path] of [
    ["audio", "/assets/media/intro.mp3"],
    ["video", "/assets/media/intro.mp4"],
  ] as const) {
    await expect
      .poll(async () =>
        decodeURIComponent(
          (await frame.locator(selector).getAttribute("src")) ?? "",
        ),
      )
      .toMatch(new RegExp(`${WEBVIEW_RESOURCE.source}.*${path}$`));
  }
  // 実行・検証: 再生ボタンを押すと再生位置が進む
  await expectPlayed(frame);
});

/** `other.md` を指すノードと外部の URL を指すノードのフロー図を持つ Markdown */
const FLOW_LINK_GUIDE = [
  "# 図のリンク",
  "",
  "<!-- flow -->",
  "",
  "```json",
  JSON.stringify({
    title: "リンク",
    scope: "点検",
    updated: "2026-11-05",
    width: 520,
    height: 152,
    nodes: [
      {
        id: "doc",
        kind: "script",
        x: 20,
        y: 40,
        w: 200,
        h: 72,
        name: "別の文書を開く",
        href: "./other.md",
      },
      {
        id: "web",
        kind: "script",
        x: 300,
        y: 40,
        w: 200,
        h: 72,
        name: "サイトを開く",
        href: EXTERNAL_URL,
      },
    ],
    wires: [],
  }),
  "```",
  "",
  "<!-- /flow -->",
  "",
].join("\n");

// フロー図のノードのリンクを、本文のリンクと同じ種類ごとの先で開き、プレビューの文書は変わらない（正常シナリオ（フロー図のノードのリンク））
test("test_normal_when_flow_node_link", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "docs/flow.md": FLOW_LINK_GUIDE, "docs/other.md": "# 別の文書\n" },
  });
  await session.openFile("docs/flow.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("figure.mdmark-diagram");
  const linkOf = (id: string) =>
    frame.locator(`[data-node="${id}"] a.mdmark-diagram-node-link`);
  // 実行・検証: 外部の URL を指すノードを押すと、ブラウザで開く
  await linkOf("web").click();
  await expect.poll(() => session.openedUrls()).toEqual([EXTERNAL_URL]);
  await expect(frame.locator("h1")).toContainText("図のリンク");
  // 実行・検証: other.md を指すノードを押すと、エディタで開く
  await linkOf("doc").click();
  await expect(
    session.win.getByRole("tab", { name: /^other\.md/ }),
  ).toHaveCount(1);
  await session.win.waitForTimeout(1000);
  expect(await session.openedUrls()).toEqual([EXTERNAL_URL]);
  await expect(frame.locator("h1")).toContainText("図のリンク");
});
