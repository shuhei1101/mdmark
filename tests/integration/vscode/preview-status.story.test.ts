import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 配布物を読み終えていないとき、回る印と題「mdmark を読み込んでいます」を出す（Loading）
test("test_loading", async () => {
  // 準備・実行
  const page = await holder.openStory("vscode-previewstatus--loading");
  // 検証
  const status = page.locator(".mdmark-preview-loading");
  await expect(status.getAttribute("role")).resolves.toBe("status");
  await expect(status.locator("h1").innerText()).resolves.toBe(
    "mdmark を読み込んでいます",
  );
  await expect(
    status.locator("progress").getAttribute("aria-label"),
  ).resolves.toBe("読み込み中");
  await expect(page.locator("#storybook-root button").count()).resolves.toBe(0);
});

// 動きを減らす設定のとき、回る印は 6 秒で 1 回転にゆっくり回す（Loading）
test("test_loading_when_reduced_motion", async () => {
  // 準備
  const page = await holder.openStory("vscode-previewstatus--loading");
  await page.emulateMedia({ reducedMotion: "reduce" });
  // 実行
  const durations = await page.evaluate(
    () =>
      getComputedStyle(
        document.querySelector(".mdmark-preview-spinner") as Element,
      ).animationDuration,
  );
  // 検証
  expect(durations).toBe("6s");
});

// 配布物を読めないとき、理由と「リロード」を出す（Offline）
test("test_offline", async () => {
  // 準備・実行
  const page = await holder.openStory("vscode-previewstatus--offline");
  // 検証
  const notice = page.locator(".mdmark-preview-notice");
  await expect(notice.getAttribute("role")).resolves.toBe("status");
  await expect(notice.locator("h1").innerText()).resolves.toBe(
    "プレビューを表示できません",
  );
  await expect(notice.locator("p").innerText()).resolves.toBe(
    "mdmark（v0.7.0）を jsDelivr から読み込めませんでした。ネットワークにつながっているかを確かめてから、リロードしてください。",
  );
  await expect(notice.locator("p code").innerText()).resolves.toBe("v0.7.0");
  const button = notice.locator('button[data-action="reload"]');
  await expect(button.innerText()).resolves.toBe("リロード");
});

// 「リロード」は Tab で届き、フォーカスの輪郭を出す（Offline）
test("test_offline_when_keyboard_focus", async () => {
  // 準備
  const page = await holder.openStory("vscode-previewstatus--offline");
  // 実行
  await page.keyboard.press("Tab");
  // 検証
  const focused = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    return {
      action: active.dataset.action,
      outlineStyle: getComputedStyle(active).outlineStyle,
      outlineWidth: getComputedStyle(active).outlineWidth,
    };
  });
  expect(focused.action).toBe("reload");
  expect(focused.outlineStyle).not.toBe("none");
  expect(focused.outlineWidth).not.toBe("0px");
});

// 知らせの枠の色の変数で、枠の地と線を変えられる（Offline）
test("test_offline_when_color_overridden", async () => {
  // 準備
  const page = await holder.openStory("vscode-previewstatus--offline");
  await page.addStyleTag({
    content:
      ":root { --mdmark-color-notice-bg: rgb(1, 2, 3); --mdmark-color-notice-border: rgb(4, 5, 6); --mdmark-color-notice-text: rgb(7, 8, 9); }",
  });
  // 実行
  const colors = await page.evaluate(() => {
    const notice = getComputedStyle(
      document.querySelector(".mdmark-preview-notice") as Element,
    );
    const button = getComputedStyle(
      document.querySelector(".mdmark-preview-button") as Element,
    );
    return {
      background: notice.backgroundColor,
      text: notice.color,
      noticeBorder: notice.borderTopColor,
      buttonBorder: button.borderTopColor,
    };
  });
  // 検証
  expect(colors).toEqual({
    background: "rgb(1, 2, 3)",
    text: "rgb(7, 8, 9)",
    noticeBorder: "rgb(4, 5, 6)",
    buttonBorder: "rgb(4, 5, 6)",
  });
});

// 指定したバージョンが無いとき、設定を直す文を出す（VersionMissing）
test("test_version_missing", async () => {
  // 準備・実行
  const page = await holder.openStory("vscode-previewstatus--version-missing");
  // 検証
  const notice = page.locator(".mdmark-preview-notice");
  await expect(notice.locator("p").innerText()).resolves.toBe(
    "設定 mdmark.version に指定したバージョン v9.9.9 の mdmark が見つかりませんでした。存在するバージョンか latest に直してから、リロードしてください。",
  );
  await expect(notice.locator("p code").allInnerTexts()).resolves.toEqual([
    "mdmark.version",
    "v9.9.9",
    "latest",
  ]);
  await expect(
    notice.locator('button[data-action="reload"]').innerText(),
  ).resolves.toBe("リロード");
});

// バージョンの文字が長くても、枠の中で折り返し、横にスクロールしない（VersionMissingLong）
test("test_version_missing_long", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "vscode-previewstatus--version-missing-long",
  );
  // 検証
  const layout = await page.evaluate(() => {
    const notice = document.querySelector(".mdmark-preview-notice");
    const code = document.querySelector(".mdmark-preview-notice p code");
    if (!notice || !code) {
      throw new Error("描けない理由が描かれていない");
    }
    const noticeBox = notice.getBoundingClientRect();
    const boxes = [...code.getClientRects()];
    return {
      outside: boxes.some(
        (box) => box.right > noticeBox.right || box.left < noticeBox.left,
      ),
    };
  });
  expect(layout.outside).toBe(false);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// バージョンを決められないとき、取得できなかった理由とネットワークの確認を伝える（VersionUndecidable）
test("test_version_undecidable", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "vscode-previewstatus--version-undecidable",
  );
  // 検証
  const notice = page.locator(".mdmark-preview-notice");
  await expect(notice.locator("p").innerText()).resolves.toBe(
    "読む mdmark のバージョンを決められませんでした。GitHub から最新のバージョンを取得できず、前回のバージョンも残っていません。ネットワークにつながっているかを確かめてから、リロードしてください。",
  );
  await expect(notice.locator("p code").count()).resolves.toBe(0);
});

// 差分に対応しないバージョンを読んだとき、読んだバージョンと直し方を伝え、「リロード」を出す（DiffUnsupported）
test("test_diff_unsupported", async () => {
  // 準備・実行
  const page = await holder.openStory("vscode-previewstatus--diff-unsupported");
  // 検証
  const notice = page.locator(".mdmark-preview-notice");
  await expect(notice.getAttribute("role")).resolves.toBe("status");
  await expect(notice.locator("h1").innerText()).resolves.toBe(
    "プレビューを表示できません",
  );
  await expect(notice.locator("p").innerText()).resolves.toBe(
    "読み込んだ mdmark（v0.8.0）は差分の表示に対応していません。設定 mdmark.version を差分の表示に対応したバージョンか latest に変更してから、リロードしてください。",
  );
  await expect(notice.locator("p code").allInnerTexts()).resolves.toEqual([
    "v0.8.0",
    "mdmark.version",
    "latest",
  ]);
  await expect(
    notice.locator('button[data-action="reload"]').innerText(),
  ).resolves.toBe("リロード");
  await expect(pageOverflows(page)).resolves.toBe(false);
});
